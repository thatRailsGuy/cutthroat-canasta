import type axe from 'axe-core'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'

/**
 * axe-core in headless Chromium, for the checks that need a layout and so can't run in jsdom
 * (test/axe.test.tsx): contrast and target size. Starts the game server and the Vite dev
 * server (`/dev/table` is left out of builds), seeds a public table for the home page and the
 * lobby, and checks each page. Fails only on violations. "Needs review" results are listed,
 * not failed: contrast over the gingham always lands there, as axe can't read a background
 * image.
 *
 * Run with `npm run axe:browser -w @canasta/web`. Needs Chromium (`npx playwright install
 * chromium`) and free ports 8787 and 5173.
 */

const SERVER = 'http://localhost:8787'
const WEB = 'http://localhost:5173'
const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const AXE = fileURLToPath(import.meta.resolve('axe-core/axe.min.js'))
const START_TIMEOUT_MS = 90_000
const PING_MS = 20_000

const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }
const HAND = '[aria-label="Your hand"]'

/** The jsdom test's rules, plus the two that need a layout and the full page's landmarks. */
const OPTIONS: axe.RunOptions = {
  runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
  rules: {
    // A card button shows "K♥" and is named "King of hearts". The face is a symbol, not a
    // text label, and the name is what a speech-input user would say.
    'label-content-name-mismatch': { enabled: false },
  },
}

interface Check {
  name: string
  path: string
  viewport: { width: number; height: number }
  /** A selector that matches once the page shows what's checked. */
  ready: string
  /** Runs just before the page opens. */
  before?: () => void
}

interface Seat {
  socket: WebSocket
  token: string
}

const children: ChildProcess[] = []

async function main() {
  for (const url of [SERVER, WEB]) {
    if (await fetch(url).catch(() => null)) {
      throw new Error(`Something is already serving ${url}. Stop the dev servers first.`)
    }
  }
  // wrangler dev needs the assets directory, as `npm run dev:server` makes it.
  mkdirSync(`${ROOT}/apps/web/dist`, { recursive: true })
  start('wrangler', ['dev', '--port', '8787'], 'apps/server')
  await waitFor(`${SERVER}/api/tables`)
  start('vite', ['--port', '5173', '--strictPort'], 'apps/web')
  await waitFor(`${WEB}/api/tables`)

  const code = await createGame()
  const ann = await sit(code, 'Ann')
  const bob = await sit(code, 'Bob')
  ann.socket.send(JSON.stringify({ type: 'setPublic', public: true }))
  await waitForListing(code)
  const ping = setInterval(() => {
    for (const { socket } of [ann, bob]) {
      if (socket.readyState === WebSocket.OPEN) socket.send('{"type":"ping"}')
    }
  }, PING_MS)

  const checks: Check[] = [
    { name: 'home', path: '/', viewport: DESKTOP, ready: "text=Ann's table" },
    {
      name: 'lobby, as the host',
      // Ann's seat goes to the page, by her rejoin link.
      path: `/g/${code}#token=${ann.token}`,
      viewport: DESKTOP,
      ready: 'h1:has-text("Pull up a chair")',
      before: () => ann.socket.close(),
    },
    { name: '/dev/table, desktop', path: '/dev/table', viewport: DESKTOP, ready: HAND },
    { name: '/dev/table, phone', path: '/dev/table', viewport: PHONE, ready: HAND },
    { name: '/rules', path: '/rules', viewport: DESKTOP, ready: 'h1:has-text("Rules")' },
    { name: '/learn', path: '/learn', viewport: DESKTOP, ready: HAND },
  ]

  const browser = await chromium.launch()
  let failed = 0
  try {
    for (const check of checks) {
      check.before?.()
      if (!(await run(browser, check))) failed++
    }
  } finally {
    clearInterval(ping)
    bob.socket.close()
    await browser.close()
  }
  if (failed > 0) {
    console.error(`\n${failed} of ${checks.length} pages have violations.`)
    process.exitCode = 1
  } else {
    console.log(`\nNo violations on ${checks.length} pages.`)
  }
}

/** Checks one page. True if it has no violations. */
async function run(browser: Browser, check: Check): Promise<boolean> {
  const context = await browser.newContext({ viewport: check.viewport, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    await page.goto(WEB + check.path)
    await page.locator(check.ready).first().waitFor()
    await settle(page)
    await page.addScriptTag({ path: AXE })
    const results = await page.evaluate(
      (options) => (window as unknown as { axe: typeof axe }).axe.run(document, options),
      OPTIONS,
    )
    const size = `${check.viewport.width}×${check.viewport.height}`
    console.log(`\n${check.name} (${size}): ${results.violations.length} violations`)
    for (const v of results.violations) {
      console.log(`  FAIL ${v.id} (${v.impact}): ${v.help}`)
      for (const node of v.nodes) console.log(`       ${node.target.join(' ')}`)
    }
    for (const v of results.incomplete) {
      console.log(`  needs review: ${v.id}, ${v.nodes.length} nodes`)
    }
    return results.violations.length === 0
  } finally {
    await context.close()
  }
}

/** Waits for the fonts and two frames, so contrast is checked on the page as it is drawn. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

async function createGame(): Promise<string> {
  const response = await fetch(`${SERVER}/api/games`, { method: 'POST' })
  if (!response.ok) throw new Error(`Could not create a game: ${response.status}`)
  const { code } = (await response.json()) as { code: string }
  return code
}

/** Takes a seat on its own socket, and keeps the socket open. */
function sit(code: string, name: string): Promise<Seat> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${SERVER.replace(/^http/, 'ws')}/api/games/${code}/ws`)
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'join', name })))
    socket.addEventListener('error', () => reject(new Error(`${name} could not connect`)))
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (message.type === 'joined') resolve({ socket, token: message.token })
      else if (message.type === 'error') reject(new Error(`${name}: ${message.message}`))
    })
  })
}

async function waitForListing(code: string) {
  await poll(async () => {
    const response = await fetch(`${SERVER}/api/tables`)
    const { tables } = (await response.json()) as { tables: { code: string }[] }
    return tables.some((t) => t.code === code)
  }, `table ${code} on the home page's list`)
}

async function waitFor(url: string) {
  await poll(async () => (await fetch(url)).ok, url)
}

async function poll(test: () => Promise<boolean>, what: string) {
  const end = Date.now() + START_TIMEOUT_MS
  while (Date.now() < end) {
    if (await test().catch(() => false)) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for ${what}`)
}

/**
 * Starts a workspace's server from the root's node_modules/.bin, in its own process group so
 * stop() ends its children too.
 */
function start(bin: string, args: string[], workspace: string) {
  const child = spawn(`${ROOT}/node_modules/.bin/${bin}`, args, {
    cwd: `${ROOT}/${workspace}`,
    detached: true,
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  children.push(child)
}

function stop() {
  for (const child of children) {
    if (child.pid !== undefined) {
      try {
        process.kill(-child.pid)
      } catch {
        // Already gone.
      }
    }
  }
}

process.on('SIGINT', () => {
  stop()
  process.exit(130)
})

try {
  await main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  stop()
}
