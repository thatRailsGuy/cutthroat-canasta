# Cutthroat Canasta Web Client Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@canasta/web` (`apps/web`), the React client: a home page to create or join a game, the lobby, the table with a staging area that previews legality through the engine, the round-end scoreboard, the game-over screen, and a rules page that also opens as a drawer during a game. Add a small server change so a dead phone's half-open socket stops counting as connected.

**Architecture:** Logic lives in plain TypeScript modules that React doesn't touch, and each has a unit test:
- `connection.ts`: one game's WebSocket. It reconnects with backoff, pings on an interval, and drops a socket that has gone silent.
- `gameState.ts`: a reducer that folds server messages into the client state (view, presence, toasts, seat notices, rejoin tokens).
- `staging.ts`: the staging area's state, the `MeldBatch` it builds, and the live `legalityPreview`.
- `feed.ts`, `cards.ts`, `rules/tables.ts`: feed text, card labels and sorting, and rules tables built from the engine constants.

`useGame` joins these to React: it owns a `GameConnection`, sends `join` on every open (with the saved token when there is one), and dispatches messages into the reducer. Components are presentational. The server stays authoritative; the client imports `@canasta/engine` only for `legalityPreview`, a few rule helpers, the constants and `RULE_ERROR_SECTIONS`, and it imports only *types* from `@canasta/server/protocol`.

The rules page renders its tables from the engine constants. Its worked examples are data in a new engine module, `packages/engine/src/examples.ts` (package export `@canasta/engine/examples`), so an engine test can check every example against `meldRules`, `pileRules` and `scoring`.

**Tech Stack:** React 19.3, React Router 8.4 (declarative mode: `BrowserRouter`, `Routes`), Vite 8.3 with `@vitejs/plugin-react` 6.1, CSS modules (no UI framework), TypeScript 6 (strict), Vitest 5 (the root install) with jsdom 29 and Testing Library (`@testing-library/react` 16, `user-event` 14, `jest-dom` 7), ESLint 10 with `eslint-plugin-react-hooks` 7. The server side uses the existing wrangler 4.124 and `@cloudflare/vitest-pool-workers` 0.22 setup.

**Spec:** `docs/superpowers/specs/2026-09-27-cutthroat-canasta-design.md`, Sections 6 (Client), 7 (Rules page) and 8 (Testing). Section 3 is the authority for every rule the rules page states. Sections 4 and 5 define the engine API and the protocol. The code is the authority for names: `packages/engine/src/index.ts` and `apps/server/src/protocol.ts`.

## Global Constraints

- **Runtime dependencies:** `apps/web` may depend only on `react`, `react-dom`, `react-router` and `@canasta/engine` (as `"*"`). It imports `@canasta/server/protocol` with `import type` only; `@canasta/server` is a devDependency (`"*"`) so the types resolve. An ESLint rule (Task 1) rejects any value import from `@canasta/server`. No other package may be added without asking.
- **Vitest version:** `apps/web` uses the root Vitest 5 and doesn't declare its own. Only `apps/server` needs Vitest 4, because `@cloudflare/vitest-pool-workers@0.22` pins `vitest ^4.1`; the web tests run in jsdom, which Vitest 5 supports (`jsdom: "*"` peer). Don't change the root, engine or server Vitest.
- **jsdom version:** use `jsdom@^29.1.1`. jsdom 30 requires Node `^24.15.0`, and this machine runs Node 24.10 (the README says Node 24+).
- **Versions (checked with `npm view` on 2026-09-28):** react/react-dom 19.3.0, react-router 8.4.0 (peer `react >=19.2.7`), vite 8.3.1 (already in the tree through Vitest), `@vitejs/plugin-react` 6.1.1 (peer `vite ^8.0.0`; its other peers are optional), `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.7, `@testing-library/jest-dom` 7.0.1, `@types/react` and `@types/react-dom` 19.3.0, `eslint-plugin-react-hooks` 7.1.1 (peer `eslint ^10`).
- **Lockfile:** whenever dependencies change, regenerate it cleanly (the handoff's procedure, npm/cli#4828):
  ```sh
  rm -rf package-lock.json node_modules apps/*/node_modules packages/*/node_modules
  npm install --package-lock-only --ignore-scripts
  npm ci
  grep -c '@rolldown/binding-' package-lock.json   # must be non-zero
  ```
  An incremental `npm install` strips the rolldown bindings, and Vitest then fails with `Cannot find native binding`.
- **TypeScript:** strict, `verbatimModuleSyntax` (type-only imports use `import type`). TypeScript 6 defaults `types` to `[]`, so `apps/web/tsconfig.json` lists `"types": ["vite/client"]` (CSS modules and side-effect CSS imports need it). Target stays ES2022: use `[...a].sort()`, not `toSorted()`.
- **Style:** Prettier (no semicolons, single quotes, `printWidth` 100). Run `npm run format` before every commit, and `npm run format:check` must pass. Match the existing code: small named exports, doc comments on anything non-obvious, no default exports except config files.
- **Lint:** `eslint-plugin-react-hooks` `recommended` (including its React Compiler rules) applies to `apps/web/**`. If a rule fires on this plan's code, restructure the code; don't disable the rule. `typescript-eslint` already turns off `no-undef` for `.ts`/`.tsx`, so browser globals need no `globals` package.
- **Protocol use:** the client must use `state.connected` (presence dots), `removed` (back to `/` with a message), `reissued` (the host copies a rejoin link), `seatReissued` (a notice in the feed area for everyone), `leave` and `kick` (lobby), and `nextRound` (any player). A `ROUND_NOT_OVER` error is ignored silently, because two players can press **Next round** together.
- **Tokens:** saved in localStorage under `canasta:token:<CODE>`. A rejoin link is `/g/<CODE>#token=<token>`: the page saves the token, removes the hash with a `replace` navigation, and joins with it. Storage access is wrapped in `try`, because it can throw in private mode.
- **Tests:** component tests only for the staging area and the rules examples (spec Section 8). Plain modules get unit tests. Everything else is checked by typecheck, lint, the build and the manual playtest in Task 8.
- **Commands:** from the root, `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`. For one workspace, `npm test -w @canasta/web`.
- **Commits:** plain imperative sentences, with no attribution lines (a hook rejects them). Never sign commits.

## Amendments (decided 2026-09-28, after drafting)

These override the task text below where they differ.

- **Presence refresh:** keep it minimal. No Durable Object alarm (Open Question 1).
- **Heartbeat timing:** ping every 20 s, stale after 70 s, as written (Open Question 2).
- **Unknown game codes:** add `GET /api/games/:code` (Open Question 3).
  - **Task 2 (server):** add an RPC method `GameRoom.exists(): boolean` that returns `this.room !== null` and never writes storage. The Worker route returns `200 { "code": "<CODE>" }` when the room exists, and 404 for an unknown or malformed code. Codes are normalized as in the WebSocket route. Worker tests cover a created game (200, with the normalized code), a lowercase code (200), an unknown code (404) and a malformed code (404).
  - **Task 3 (`api.ts`):** add `gameExists(code): Promise<boolean | null>`. It returns `true` on 200, `false` on 404, and `null` on a network error or any other status, and it has a unit test with a stubbed `fetch`.
  - **Task 4 (`GamePage`):** before opening the connection, call `gameExists`. On `false`, show "There's no game with the code <CODE>." with a link home, and don't connect. On `true` or `null`, connect as written. The "Can't reach game…" message stays as the fallback for `null`.
  - **README (Task 11):** document the route.

## Review Focus

- **No server code in the bundle.** Expected: `apps/web/dist/assets/*.js` contains no `zod` and no `parseClientMessage`. Pinned in: Task 1 (lint rule) and Task 8 (Step 2 checks the bundle).
- **Half-open sockets.** Expected: a socket that has sent nothing (messages or pings) for `STALE_AFTER_MS` is unbound and closed, so its player is not in `connected` and the host can reissue the seat; a live client never goes stale, because it pings every 20 s. Pinned in: Task 2 (`drops a silent socket, so its seat can be reissued`) and Task 3 (`closes a silent, half-open socket and reconnects`).
- **Token handling.** Expected: the `#token=` hash is removed from the address bar at once; a saved token that the server rejects (the seat was reissued) is deleted, and the join form shows the error. Pinned in: Task 4 (`useGame`, `GamePage`) and the Task 8 playtest.
- **Staging correctness.** Expected: the batch sent is exactly what the preview checked, pickups carry the top discard's id, and cards that left your hand drop out of the staging state. Pinned in: Task 6 (`staging.test.ts`, `StagingArea.test.tsx`).
- **Rules accuracy.** Expected: every rule the page states agrees with spec Section 3 (the first README draft got Black 3s, the personal freeze and the concealed bonus wrong), every table renders from engine constants, and every example is checked by the engine. Pinned in: Task 9 (`examples.test.ts`, `tables.test.ts`) and Task 10 (Step 3, a line-by-line check against Section 3). The "Standard Canasta" column in the house-rules table is general knowledge, not from the spec: the user should read it once.

---

## File Structure

```text
apps/web/
  package.json               @canasta/web
  tsconfig.json
  vite.config.ts             React plugin, /api proxy (with WebSockets), Vitest jsdom config
  index.html
  src/
    main.tsx                 createRoot + BrowserRouter
    App.tsx                  routes: /, /g/:code, /rules
    global.css               design tokens, reset, buttons
    api.ts                   createGame (POST /api/games), socketUrl, rejoinLink, normalizeCode
    storage.ts               tokens and name in localStorage, tokenFromHash
    connection.ts            GameConnection: reconnect with backoff, heartbeat
    gameState.ts             reducer: server messages → client state
    useGame.ts               React hook: connection + reducer + join
    cards.ts                 card labels, names, hand sort
    staging.ts               staging state, MeldBatch, preview, useStaging
    feed.ts                  FeedEvent → text
    components/
      Card.tsx, Card.module.css
      Hand.tsx, MeldList.tsx, OpponentPanel.tsx, CenterPile.tsx, Table.module.css
      StagingArea.tsx, StagingArea.module.css
      WhyLink.tsx
      Toasts.tsx, Toasts.module.css
      Feed.tsx, BreakdownTable.tsx, RoundEnd.tsx, GameOver.tsx
      RulesDrawer.tsx, RulesDrawer.module.css
    pages/
      HomePage.tsx, GamePage.tsx, Lobby.tsx, Table.tsx, RulesPage.tsx, Pages.module.css
    rules/
      sections.ts            PageSection, table-of-contents order
      drawer.ts              RulesDrawerContext
      tables.ts              rows for the rules tables, from engine constants
      RuleExample.tsx        renders one worked example
      RulesContent.tsx       the rules prose (shared by the page and the drawer)
      Rules.module.css       page layout, sticky/collapsible TOC, print stylesheet
  test/
    setup.ts                 jest-dom matchers, cleanup
    fixtures.ts              card(), makeView()
    connection.test.ts, gameState.test.ts, cards.test.ts, staging.test.ts, feed.test.ts,
    tables.test.ts, StagingArea.test.tsx, RuleExample.test.tsx
packages/engine/
  src/examples.ts            worked examples as data (export ./examples)
  test/examples.test.ts
apps/server/
  src/presence.ts            lastSeen, isStale
  test/presence.test.ts
```

Files modified outside `apps/web`: root `package.json` (`dev:web`, `eslint-plugin-react-hooks`), `package-lock.json`, `eslint.config.js`, `apps/server/src/protocol.ts`, `apps/server/src/gameRoom.ts`, `apps/server/test/worker.test.ts`, `packages/engine/package.json`, `README.md`, and the handoff.

---

### Task 1: Web package scaffold and tooling

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/global.css`, `apps/web/test/setup.ts`
- Modify: root `package.json`, `eslint.config.js`, `package-lock.json`
- Test: `apps/web/test/smoke.test.tsx` (removed in Task 4)

**Interfaces:**
- Consumes: nothing yet.
- Produces:
  - The `@canasta/web` package with scripts `dev`, `build`, `preview`, `test`, `typecheck`.
  - A Vite dev server that proxies `/api` (HTTP and WebSocket) to `http://localhost:8787`.
  - A jsdom Vitest harness with jest-dom matchers.
  - Root script `npm run dev:web`.

- [ ] **Step 1: Create the package files**

`apps/web/package.json`:
```json
{
  "name": "@canasta/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@canasta/engine": "*",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "react-router": "^8.4.0"
  },
  "devDependencies": {
    "@canasta/server": "*",
    "@testing-library/dom": "^10.4.2",
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.7",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "jsdom": "^29.1.1",
    "vite": "^8.3.1"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src", "test", "vite.config.ts"]
}
```

`apps/web/vite.config.ts`:
```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // wrangler dev (npm run dev:server). ws: true forwards the WebSocket upgrade too.
      '/api': { target: 'http://localhost:8787', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
  },
})
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cutthroat Canasta</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
```

`apps/web/src/global.css` holds the design tokens used by every module stylesheet (felt green table, paper background, card red, gold highlight, ok/bad colors, radius, shadow, a serif for the rules prose), a box-sizing reset, and 44 px minimum button height for touch:

`apps/web/src/global.css`:
```css
:root {
  --felt: #1f5f3f;
  --felt-dark: #174a31;
  --paper: #fbf8f1;
  --ink: #1d1d1f;
  --muted: #5f6368;
  --red: #c0262d;
  --gold: #e0b341;
  --ok: #1e7b34;
  --bad: #b3261e;
  --radius: 8px;
  --shadow: 0 1px 3px rgb(0 0 0 / 0.25);
  --font: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --serif: 'Iowan Old Style', 'Palatino Linotype', Georgia, serif;
  color-scheme: light;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font);
  color: var(--ink);
  background: var(--paper);
  line-height: 1.5;
}

button {
  font: inherit;
  min-height: 44px;
  padding: 0 1rem;
  border-radius: var(--radius);
  border: 1px solid var(--ink);
  background: white;
  cursor: pointer;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

:focus-visible {
  outline: 3px solid var(--gold);
  outline-offset: 2px;
}
```

`apps/web/src/App.tsx` (a placeholder; Task 4 replaces it with the routes):
```tsx
export function App() {
  return <h1>Cutthroat Canasta</h1>
}
```

`apps/web/src/main.tsx` (Task 4 adds the router):
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 2: Add the root script and the lint plugin**

In the root `package.json`:
- `scripts`: add `"dev:web": "npm run dev -w @canasta/web"` after `dev:server`.
- `devDependencies`: add `"eslint-plugin-react-hooks": "^7.1.1"` (alphabetical, after `eslint`).

Replace `eslint.config.js`:

`eslint.config.js`:
```js
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.wrangler/**',
      '**/coverage/**',
      '**/worker-configuration.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    rules: {
      // The client may use the server's protocol types, never its code.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@canasta/server', '@canasta/server/*'],
              allowTypeImports: true,
              message: 'Import only types from the server.',
            },
          ],
        },
      ],
    },
  },
)
```

- [ ] **Step 3: Install with a clean lockfile**

Run the lockfile procedure from Global Constraints. Expected:
- `grep -c '@rolldown/binding-' package-lock.json` prints a non-zero count.
- `node -e "console.log(require('./node_modules/vitest/package.json').version)"` prints `5.x`, and `node -e "console.log(require('./apps/server/node_modules/vitest/package.json').version)"` prints `4.x`.
- `node -e "console.log(require('./node_modules/jsdom/package.json').version)"` prints `29.x`.
- `@canasta/engine` and `@canasta/server` are workspace links (`ls -l node_modules/@canasta`).

If npm moves Vitest 4 to the root or nests a second Vitest 5 under `apps/web`, stop and report NEEDS_CONTEXT.

- [ ] **Step 4: Write the smoke test**

`apps/web/test/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { App } from '../src/App'

it('renders in jsdom with jest-dom matchers', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Cutthroat Canasta' })).toBeInTheDocument()
})
```

- [ ] **Step 5: Run all checks**

Run: `npm run format && npm test && npm run typecheck && npm run lint && npm run format:check && npm run build -w @canasta/web`
Expected: engine 206, server 86 and web 1 tests pass; typecheck, lint and format are clean; `vite build` writes `apps/web/dist/` (git-ignored by the root `dist/` rule).

Then check that the lint rules are live. Create a scratch file `apps/web/src/probe.tsx` containing `import { HEARTBEAT_PING } from '@canasta/server/protocol'` and a `useState` call inside an `if`. `npx eslint apps/web/src/probe.tsx` must report `@typescript-eslint/no-restricted-imports` and `react-hooks/rules-of-hooks`. Delete the file with `rm -f` (a plain `rm` may prompt).

- [ ] **Step 6: Commit**

```bash
git add apps/web package.json package-lock.json eslint.config.js
git commit -m "Scaffold web client package with Vite, React and Vitest"
```

---

### Task 2: Server heartbeat and stale-socket presence

**Files:**
- Create: `apps/server/src/presence.ts`
- Modify: `apps/server/src/protocol.ts`, `apps/server/src/gameRoom.ts`
- Test: `apps/server/test/presence.test.ts`, `apps/server/test/worker.test.ts`

**Interfaces:**
- Consumes: the Hibernation API's `ctx.setWebSocketAutoResponse`, `WebSocketRequestResponsePair` and `ctx.getWebSocketAutoResponseTimestamp(ws)` (all declared in `worker-configuration.d.ts`).
- Produces, in `protocol.ts`:
  - `HEARTBEAT_PING = '{"type":"ping"}'`, `HEARTBEAT_PONG = '{"type":"pong"}'`
  - `HEARTBEAT_INTERVAL_MS = 20_000`, `STALE_AFTER_MS = 70_000`, `STALE_CLOSE_CODE = 4000`
  - `ServerMessage` gains `{ type: 'pong' }`.
- Produces, in `presence.ts`: `lastSeen(seenAt: number, autoResponseAt: Date | null): number` and `isStale(lastSeenAt: number, now: number): boolean`.
- Behavior: the Durable Object answers a ping without waking. Every socket's attachment records `seenAt` (connect time, or the last message). Before handling a message or a close, the room unbinds and closes every socket whose last sign of life (the later of `seenAt` and the last auto-response) is older than `STALE_AFTER_MS`. So a dead phone stops counting as `connected`, `reissue` works for it, and its socket can't read the seat after a reissue.

Why this design: the auto-response costs nothing while the room hibernates, and the runtime records when it last answered each socket, so the server needs no timer and no extra storage writes for pings. The limit (70 s) spans three missed pings plus slack, because browsers may slow timers in background tabs to once a minute. Limitation: nothing wakes the room when a socket goes stale, so other players see the stale dot until the next message or close in that room (any action refreshes it). See Open Questions.

- [ ] **Step 1: Write the failing tests**

`apps/server/test/presence.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isStale, lastSeen } from '../src/presence'
import { STALE_AFTER_MS } from '../src/protocol'

describe('presence', () => {
  it('uses the later of the last message and the last answered ping', () => {
    expect(lastSeen(1_000, null)).toBe(1_000)
    expect(lastSeen(1_000, new Date(5_000))).toBe(5_000)
    expect(lastSeen(9_000, new Date(5_000))).toBe(9_000)
  })

  it('counts a socket as stale only after STALE_AFTER_MS of silence', () => {
    expect(isStale(0, STALE_AFTER_MS)).toBe(false)
    expect(isStale(0, STALE_AFTER_MS + 1)).toBe(true)
  })
})
```

In `apps/server/test/worker.test.ts`, change the protocol import to `import { HEARTBEAT_PING, type ServerMessage } from '../src/protocol'` and append:
```ts
describe('heartbeat', () => {
  it('answers a ping with a pong and tells nobody else', async () => {
    const { ann, bob } = await startedGame()
    ann.sendRaw(HEARTBEAT_PING)
    expect(await ann.next()).toEqual({ type: 'pong' })
    await ann.expectQuiet()
    await bob.expectQuiet()
  })

  it('drops a silent socket, so its seat can be reissued', async () => {
    const { code, ann, bob, bobJoined } = await startedGame()
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code))
    await runInDurableObject(stub, async (_instance, state) => {
      for (const ws of state.getWebSockets()) {
        const attachment = ws.deserializeAttachment() as { playerId: string | null }
        if (attachment.playerId === bobJoined.playerId) {
          ws.serializeAttachment({ ...attachment, seenAt: 0 })
        }
      }
    })

    ann.send({ type: 'reissue', playerId: bobJoined.playerId })
    expect(await ann.next()).toMatchObject({ type: 'reissued', playerId: bobJoined.playerId })
    expect(await ann.next()).toEqual({ type: 'seatReissued', playerId: bobJoined.playerId })
    await bob.expectQuiet()
  })
})
```

The second test fakes a silent socket by backdating its attachment. Without the change, the reissue fails with `PLAYER_CONNECTED`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @canasta/server`
Expected: FAIL. `presence.ts` and `HEARTBEAT_PING` don't exist yet.

- [ ] **Step 3: Add the protocol constants**

In `apps/server/src/protocol.ts`, after `MAX_NAME_LENGTH`:
```ts
/**
 * Heartbeat. The Durable Object answers `HEARTBEAT_PING` with `HEARTBEAT_PONG` through a
 * WebSocket auto-response, so a ping never wakes it. The strings must match exactly.
 */
export const HEARTBEAT_PING = '{"type":"ping"}'
export const HEARTBEAT_PONG = '{"type":"pong"}'
/** How often the client pings. */
export const HEARTBEAT_INTERVAL_MS = 20_000
/**
 * A socket that has sent nothing for this long no longer counts as connected. It spans more
 * than three pings, because browsers may slow timers in background tabs to once a minute.
 */
export const STALE_AFTER_MS = 70_000
/** Close code for a socket the server dropped as stale. The client reconnects with its token. */
export const STALE_CLOSE_CODE = 4000
```

Add the last member to `ServerMessage`:
```ts
  | { type: 'seatReissued'; playerId: string }
  /** The heartbeat reply. The runtime's auto-response sends it, never the room handler. */
  | { type: 'pong' }
```

- [ ] **Step 4: Implement presence and the Durable Object changes**

`apps/server/src/presence.ts`:
```ts
import { STALE_AFTER_MS } from './protocol'

/** The latest time (ms) a socket was heard from: a message, or a ping the runtime answered. */
export function lastSeen(seenAt: number, autoResponseAt: Date | null): number {
  return Math.max(seenAt, autoResponseAt?.getTime() ?? 0)
}

export function isStale(lastSeenAt: number, now: number): boolean {
  return now - lastSeenAt > STALE_AFTER_MS
}
```

Replace `apps/server/src/gameRoom.ts`:

`apps/server/src/gameRoom.ts`:
```ts
import { DurableObject } from 'cloudflare:workers'
import type { Seed } from '@canasta/engine'
import { isStale, lastSeen } from './presence'
import {
  HEARTBEAT_PING,
  HEARTBEAT_PONG,
  STALE_CLOSE_CODE,
  parseClientMessage,
  type ServerMessage,
} from './protocol'
import { createRoom, handleMessage, stateMessage, type RoomIds, type RoomState } from './room'

interface Attachment {
  playerId: string | null
  /** When the socket connected or last sent a message (ms). Pings are tracked by the runtime. */
  seenAt: number
}

const ids: RoomIds = {
  newPlayerId: () => crypto.randomUUID(),
  newToken: () => crypto.randomUUID(),
}

export class GameRoom extends DurableObject<Env> {
  private room: RoomState | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(HEARTBEAT_PING, HEARTBEAT_PONG))
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomState>('room')) ?? null
    })
  }

  /** Called once by the Worker when it allocates a game code. Returns false if the code is taken. */
  async init(code: string, seed: Seed): Promise<boolean> {
    if (this.room) return false
    this.room = createRoom(code, seed)
    await this.ctx.storage.put('room', this.room)
    return true
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.room) return new Response('Game not found', { status: 404 })
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 })
    }
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId: null, seenAt: Date.now() } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.room) return
    const { playerId } = ws.deserializeAttachment() as Attachment
    ws.serializeAttachment({ playerId, seenAt: Date.now() } satisfies Attachment)
    this.dropStaleSockets()
    const parsed = parseClientMessage(raw)
    if (!parsed.ok) return send(ws, parsed.error)

    const outcome = handleMessage(this.room, playerId, parsed.message, ids, this.connected())
    if (outcome.changed) {
      this.room = outcome.state
      await this.ctx.storage.put('room', this.room)
    }
    if (outcome.bindPlayerId) {
      ws.serializeAttachment({
        playerId: outcome.bindPlayerId,
        seenAt: Date.now(),
      } satisfies Attachment)
    }
    for (const message of outcome.reply) send(ws, message)
    if (outcome.announce) {
      for (const socket of this.ctx.getWebSockets()) {
        if ((socket.deserializeAttachment() as Attachment).playerId) send(socket, outcome.announce)
      }
    }
    if (outcome.detach) {
      const { playerId: gone, reason } = outcome.detach
      for (const socket of this.ctx.getWebSockets()) {
        if ((socket.deserializeAttachment() as Attachment).playerId !== gone) continue
        socket.serializeAttachment({ playerId: null, seenAt: Date.now() } satisfies Attachment)
        send(socket, { type: 'removed', reason })
      }
    }
    if (outcome.broadcast) this.broadcast()
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason)
    } catch {
      // Already closed, or a reserved close code that can't be echoed.
    }
    this.dropStaleSockets()
    this.broadcast(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.dropStaleSockets()
    this.broadcast(ws)
  }

  /**
   * Unbinds and closes sockets that have been silent for too long, such as a phone that died
   * without closing its socket. Their players stop counting as connected, so the host can
   * reissue the seat, and a closed socket can't keep reading the seat's hand afterwards.
   */
  private dropStaleSockets(): void {
    const now = Date.now()
    for (const ws of this.ctx.getWebSockets()) {
      const { seenAt } = ws.deserializeAttachment() as Attachment
      if (!isStale(lastSeen(seenAt, this.ctx.getWebSocketAutoResponseTimestamp(ws)), now)) continue
      ws.serializeAttachment({ playerId: null, seenAt } satisfies Attachment)
      try {
        ws.close(STALE_CLOSE_CODE, 'No heartbeat')
      } catch {
        // Already closed.
      }
    }
  }

  /** Seated players with an open socket, in seat order. `except` is a socket that is closing. */
  private connected(except?: WebSocket): string[] {
    const ids = new Set(
      this.ctx
        .getWebSockets()
        .filter((ws) => ws !== except)
        .map((ws) => (ws.deserializeAttachment() as Attachment).playerId),
    )
    return (this.room?.game.players ?? []).map((p) => p.id).filter((id) => ids.has(id))
  }

  private broadcast(except?: WebSocket): void {
    const room = this.room
    if (!room) return
    const connected = this.connected(except)
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue
      const { playerId } = ws.deserializeAttachment() as Attachment
      if (playerId) send(ws, stateMessage(room, playerId, connected))
    }
  }
}

function send(ws: WebSocket, message: ServerMessage): void {
  try {
    ws.send(JSON.stringify(message))
  } catch {
    // The socket closed between the event and the send; its player can reconnect with their token.
  }
}
```

The changes from the current file: the `seenAt` field, the auto-response in the constructor, `seenAt` in every `serializeAttachment`, the `seenAt` update and `dropStaleSockets()` at the top of `webSocketMessage` (before parsing, so even a bad frame counts as a sign of life), and `dropStaleSockets()` before each close/error broadcast.

- [ ] **Step 5: Run all checks**

Run: `npm run format && npm test && npm run typecheck && npm run lint && npm run format:check`
Expected: 90 server tests pass (86 + 2 presence + 2 heartbeat); engine and web unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/server
git commit -m "Answer heartbeat pings and drop silent sockets from presence"
```

---

### Task 3: Protocol client

**Files:**
- Create: `apps/web/src/api.ts`, `apps/web/src/storage.ts`, `apps/web/src/connection.ts`
- Test: `apps/web/test/connection.test.ts`

**Interfaces:**
- Consumes: types `ClientMessage`, `ServerMessage`, and the literal types of `HEARTBEAT_PING` and `HEARTBEAT_INTERVAL_MS` from `@canasta/server/protocol` (type-only).
- Produces:
  - `api.ts`: `normalizeCode(input): string | null`, `createGame(): Promise<string>`, `socketUrl(code, location?)`, `rejoinLink(code, token, location?)`.
  - `storage.ts`: `loadToken`, `saveToken`, `clearToken` (by code), `loadName`, `saveName`, `tokenFromHash(hash): string | null`.
  - `connection.ts`: `type ConnectionStatus = 'connecting' | 'open' | 'reconnecting'`, `interface ConnectionOptions`, `reconnectDelay(attempt, random?)`, `RECONNECT_BASE_MS = 500`, `RECONNECT_MAX_MS = 15_000`, `SILENCE_LIMIT_MS = 45_000`, and `class GameConnection` with `start()`, `stop()`, `isOpen()`, `send(message): boolean`, `check()`.

The client can't import the server's constants as values, so `connection.ts` keeps its own copies typed as `typeof HEARTBEAT_PING` and `typeof HEARTBEAT_INTERVAL_MS`. If the server's strings or numbers change, the web typecheck fails (checked while writing this plan: a one-space difference in the ping string gives `TS2322`).

- [ ] **Step 1: Write the failing test**

`apps/web/test/connection.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GameConnection,
  RECONNECT_MAX_MS,
  SILENCE_LIMIT_MS,
  reconnectDelay,
  type ConnectionOptions,
} from '../src/connection'

class FakeSocket {
  readyState = 0
  sent: string[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null

  constructor(readonly url: string) {}

  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.closed = true
    this.readyState = 3
  }
  /** Test helpers: what the server or the network does. */
  accept() {
    this.readyState = 1
    this.onopen?.()
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }
  drop() {
    this.readyState = 3
    this.onclose?.()
  }
}

function setup(overrides: Partial<ConnectionOptions> = {}) {
  const sockets: FakeSocket[] = []
  const options = {
    url: 'ws://test/api/games/ABCDEF/ws',
    onOpen: vi.fn(),
    onMessage: vi.fn(),
    onStatus: vi.fn(),
    createSocket: (url: string) => {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      return socket as unknown as WebSocket
    },
    random: () => 1,
    ...overrides,
  }
  const connection = new GameConnection(options)
  connection.start()
  return { connection, options, sockets, latest: () => sockets.at(-1)! }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('reconnectDelay', () => {
  it('doubles from 500 ms up to the cap, with up to half taken off by jitter', () => {
    expect(reconnectDelay(0, () => 1)).toBe(500)
    expect(reconnectDelay(0, () => 0)).toBe(250)
    expect(reconnectDelay(3, () => 1)).toBe(4000)
    expect(reconnectDelay(20, () => 1)).toBe(RECONNECT_MAX_MS)
  })
})

describe('GameConnection', () => {
  it('reports the open, lets the caller join, and forwards messages', () => {
    const { connection, options, latest } = setup()
    expect(connection.send({ type: 'start' })).toBe(false)
    latest().accept()
    expect(options.onStatus).toHaveBeenLastCalledWith('open', 0)
    expect(options.onOpen).toHaveBeenCalledTimes(1)
    expect(connection.send({ type: 'join', name: 'Ann' })).toBe(true)
    expect(latest().sent).toEqual(['{"type":"join","name":"Ann"}'])
    latest().receive({ type: 'error', code: 'NOT_HOST', message: 'Only the host can do that.' })
    expect(options.onMessage).toHaveBeenCalledWith({
      type: 'error',
      code: 'NOT_HOST',
      message: 'Only the host can do that.',
    })
  })

  it('swallows pongs and ignores frames that are not JSON', () => {
    const { options, latest } = setup()
    latest().accept()
    latest().receive({ type: 'pong' })
    latest().onmessage?.({ data: 'garbage' })
    expect(options.onMessage).not.toHaveBeenCalled()
  })

  it('reconnects with backoff after a close and joins again', () => {
    const { options, sockets, latest } = setup()
    latest().accept()
    latest().drop()
    expect(options.onStatus).toHaveBeenLastCalledWith('reconnecting', 1)
    vi.advanceTimersByTime(499)
    expect(sockets).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(2)

    latest().drop()
    expect(options.onStatus).toHaveBeenLastCalledWith('reconnecting', 2)
    vi.advanceTimersByTime(1000)
    expect(sockets).toHaveLength(3)
    latest().accept()
    expect(options.onOpen).toHaveBeenCalledTimes(2)
    expect(options.onStatus).toHaveBeenLastCalledWith('open', 0)
  })

  it('pings on an interval while messages keep arriving', () => {
    const { latest } = setup()
    latest().accept()
    vi.advanceTimersByTime(20_000)
    expect(latest().sent).toEqual(['{"type":"ping"}'])
    latest().receive({ type: 'pong' })
    vi.advanceTimersByTime(20_000)
    expect(latest().sent).toHaveLength(2)
  })

  it('closes a silent, half-open socket and reconnects', () => {
    const { sockets, latest } = setup()
    latest().accept()
    const first = latest()
    vi.advanceTimersByTime(SILENCE_LIMIT_MS + 20_000)
    expect(first.closed).toBe(true)
    vi.advanceTimersByTime(RECONNECT_MAX_MS)
    expect(sockets.length).toBeGreaterThan(1)
  })

  it('stops for good when asked', () => {
    const { connection, sockets, latest } = setup()
    latest().accept()
    connection.stop()
    expect(latest().closed).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(sockets).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @canasta/web`
Expected: FAIL, because `../src/connection` can't be resolved.

- [ ] **Step 3: Implement**

`apps/web/src/api.ts`:
```ts
/** Game codes use the server's alphabet: no I, L, O, 0 or 1. */
const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/

export function normalizeCode(input: string): string | null {
  const code = input.trim().toUpperCase()
  return CODE_PATTERN.test(code) ? code : null
}

export async function createGame(): Promise<string> {
  const response = await fetch('/api/games', { method: 'POST' })
  if (response.status !== 201) throw new Error(`Could not create a game (${response.status}).`)
  const { code } = (await response.json()) as { code: string }
  return code
}

export function socketUrl(code: string, location: Location = window.location): string {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${location.host}/api/games/${code}/ws`
}

export function rejoinLink(
  code: string,
  token: string,
  location: Location = window.location,
): string {
  return `${location.origin}/g/${code}#token=${encodeURIComponent(token)}`
}
```

`apps/web/src/storage.ts`:
```ts
const tokenKey = (code: string) => `canasta:token:${code}`
const NAME_KEY = 'canasta:name'

/** localStorage can throw (private mode, blocked storage). The game still works without it. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Ignore: the player can rejoin with a link from the host.
  }
}

export const loadToken = (code: string) => read(tokenKey(code))
export const saveToken = (code: string, token: string) => write(tokenKey(code), token)
export const clearToken = (code: string) => write(tokenKey(code), null)
export const loadName = () => read(NAME_KEY) ?? ''
export const saveName = (name: string) => write(NAME_KEY, name)

/** Reads `#token=…` from a rejoin link. */
export function tokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token')
  return token ? token : null
}
```

`apps/web/src/connection.ts`:
```ts
import type {
  ClientMessage,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_PING,
  ServerMessage,
} from '@canasta/server/protocol'

// Type-only imports keep server code out of the bundle. Annotating each copy with the server
// constant's literal type makes the typecheck fail if the two ever differ.
const PING: typeof HEARTBEAT_PING = '{"type":"ping"}'
const PING_INTERVAL_MS: typeof HEARTBEAT_INTERVAL_MS = 20_000

export const RECONNECT_BASE_MS = 500
export const RECONNECT_MAX_MS = 15_000
/** Nothing heard for this long (two missed pongs) means the socket is half-open. */
export const SILENCE_LIMIT_MS = PING_INTERVAL_MS * 2 + 5_000

const OPEN = 1

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting'

export interface ConnectionOptions {
  url: string
  /** Runs on every open, including reconnects. Send `join` from here. */
  onOpen(): void
  onMessage(message: ServerMessage): void
  /** `failures` counts closes since the socket was last open. */
  onStatus(status: ConnectionStatus, failures: number): void
  createSocket?: (url: string) => WebSocket
  random?: () => number
}

/** Exponential backoff with jitter: between half and all of min(max, base * 2^attempt). */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt)
  return Math.round(ceiling / 2 + (random() * ceiling) / 2)
}

function parse(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') return null
  try {
    return JSON.parse(data) as ServerMessage
  } catch {
    return null
  }
}

/**
 * One game's WebSocket. It reconnects with backoff whenever the socket closes, and pings on an
 * interval. If nothing arrives for SILENCE_LIMIT_MS, it treats the socket as half-open, closes
 * it and reconnects, so the player rejoins with their saved token.
 */
export class GameConnection {
  private readonly options: ConnectionOptions
  private socket: WebSocket | null = null
  private failures = 0
  private stopped = true
  private lastHeard = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined
  private pingTimer: ReturnType<typeof setInterval> | undefined

  constructor(options: ConnectionOptions) {
    this.options = options
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.open()
  }

  stop(): void {
    this.stopped = true
    clearTimeout(this.reconnectTimer)
    this.discardSocket()
  }

  isOpen(): boolean {
    return this.socket?.readyState === OPEN
  }

  /** Returns false if the socket isn't open, so the message was not sent. */
  send(message: ClientMessage): boolean {
    if (!this.socket || !this.isOpen()) return false
    this.socket.send(JSON.stringify(message))
    return true
  }

  /** Drops a silent socket, or else pings. Runs on the interval and when the page is shown. */
  check(): void {
    if (!this.socket || !this.isOpen()) return
    if (Date.now() - this.lastHeard > SILENCE_LIMIT_MS) {
      this.discardSocket()
      this.scheduleReconnect()
      return
    }
    this.socket.send(PING)
  }

  private open(): void {
    const socket = (this.options.createSocket ?? ((url) => new WebSocket(url)))(this.options.url)
    this.socket = socket
    socket.onopen = () => {
      this.failures = 0
      this.lastHeard = Date.now()
      this.pingTimer = setInterval(() => this.check(), PING_INTERVAL_MS)
      this.options.onStatus('open', 0)
      this.options.onOpen()
    }
    socket.onmessage = (event: MessageEvent) => {
      this.lastHeard = Date.now()
      const message = parse(event.data)
      if (message && message.type !== 'pong') this.options.onMessage(message)
    }
    // An error event is always followed by a close event, so only close needs handling.
    socket.onclose = () => {
      if (this.socket !== socket) return
      this.discardSocket()
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return
    const delay = reconnectDelay(this.failures, this.options.random)
    this.failures += 1
    this.options.onStatus('reconnecting', this.failures)
    this.reconnectTimer = setTimeout(() => this.open(), delay)
  }

  /** Detaches and closes the current socket without triggering a reconnect. */
  private discardSocket(): void {
    clearInterval(this.pingTimer)
    const socket = this.socket
    this.socket = null
    if (!socket) return
    socket.onopen = null
    socket.onmessage = null
    socket.onclose = null
    try {
      socket.close(1000, 'Closing')
    } catch {
      // Already closed.
    }
  }
}
```

Notes:
- `onclose` ignores a socket that is no longer current, so `discardSocket()` followed by a late close event never schedules a second reconnect.
- `failures` resets on open. The UI uses it to say "Can't reach game …" after 3 closes in a row (there is no HTTP route to check whether a code exists; see Open Questions).
- The server's stale close (code 4000) needs no special case: every close reconnects, and `onOpen` rejoins with the token.

- [ ] **Step 4: Run all checks**

Run: `npm run format && npm test && npm run typecheck && npm run lint && npm run format:check`
Expected: 8 web tests pass (smoke + 7).

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "Add the game connection with reconnect and heartbeat"
```

---

### Task 4: Game state, routing, home, join and lobby

**Files:**
- Create: `apps/web/src/gameState.ts`, `apps/web/src/useGame.ts`, `apps/web/src/components/WhyLink.tsx`, `apps/web/src/components/Toasts.tsx`, `apps/web/src/components/Toasts.module.css`, `apps/web/src/pages/HomePage.tsx`, `apps/web/src/pages/GamePage.tsx`, `apps/web/src/pages/Lobby.tsx`, `apps/web/src/pages/Pages.module.css`, `apps/web/test/fixtures.ts`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/main.tsx`
- Delete: `apps/web/test/smoke.test.tsx`
- Test: `apps/web/test/gameState.test.ts`

**Interfaces:**
- Consumes: `GameConnection` and `ConnectionStatus` (Task 3); `RULE_ERROR_SECTIONS`, `PlayerView`, `RuleSection`, `MIN_PLAYERS` from the engine; types `ClientMessage`, `ServerMessage`, `ServerErrorCode`, `RemovedReason` from the protocol.
- Produces:
  - `gameState.ts`: `interface Toast { id; message; section: RuleSection | null }`, `interface SeatNotice { id; playerId }`, `interface GameState`, `type GameEvent`, `initialGameState`, `gameReducer(state, event)`, `sectionFor(code: ServerErrorCode): RuleSection | null`.
  - `useGame(code, { linkToken, autoJoinName }): { state, join(name), send(message), dismissToast(id) }`.
  - `WhyLink({ section })` (Task 10 teaches it to open the drawer).
  - `Toasts({ toasts, onDismiss })`: each toast auto-dismisses after 6 s.
  - Routes `/`, `/g/:code`, `/rules` (the rules route is added in Task 10), and a catch-all.
  - `interface GamePageState { join?: string }`: the home page's navigation state.

Join flow:
- **Home:** the player enters a name, then **Create a game** (POST, then navigate) or a code and **Join**. Both save the name and navigate to `/g/CODE` with `state: { join: name }`.
- **`/g/:code`:** reads `#token=` once, and `useGame` saves it before the first connect. The page removes the hash with a `replace` navigation. On every socket open, `useGame` joins with the saved token if there is one, else with the pending name if there is one; otherwise it waits for the join form (someone opened a shared link).
- `joined` saves the token. An error that answers a join goes to `joinError` (shown on the join form), not to a toast, and a rejected saved token is deleted.
- `removed` deletes the token, stops the connection, and the page navigates to `/` with `state: { notice }`, which the home page shows.

- [ ] **Step 1: Write the failing test**

`apps/web/test/fixtures.ts`:
```ts
import type { Card, Meld, Phase, PlayerView, Rank, Suit } from '@canasta/engine'

const SUITS: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' }

/** 'Kh' → king of hearts, 'JK' → joker, with the id you choose. */
export function card(code: string, id: number): Card {
  if (code === 'JK') return { id, rank: 'JOKER', suit: null }
  return { id, rank: code.slice(0, -1) as Rank, suit: SUITS[code.slice(-1)] }
}

/** A two-player view where it is your turn ("you" sits first). */
export function makeView(opts: {
  hand: Card[]
  phase: Phase
  melds?: Meld[]
  top?: Card | null
  score?: number
  turnsThisRound?: number
  hasPickedUpPile?: boolean
}): PlayerView {
  const melds = opts.melds ?? []
  const you = {
    id: 'you',
    name: 'You',
    score: opts.score ?? 0,
    hand: opts.hand,
    melds,
    red3s: [],
    hasPickedUpPile: opts.hasPickedUpPile ?? false,
    turnsThisRound: opts.turnsThisRound ?? 2,
    meldedBeforeThisTurn: melds.length > 0,
  }
  const top = opts.top === undefined ? card('Kc', 900) : opts.top
  return {
    you,
    players: [
      {
        id: 'you',
        name: 'You',
        score: you.score,
        handCount: opts.hand.length,
        melds,
        red3s: [],
        turnsThisRound: you.turnsThisRound,
      },
      { id: 'bob', name: 'Bob', score: 0, handCount: 13, melds: [], red3s: [], turnsThisRound: 1 },
    ],
    round: {
      number: 1,
      dealer: 1,
      current: 0,
      phase: opts.phase,
      stockCount: 40,
      discardTop: top,
      discardCount: top ? 3 : 0,
      pileFrozenForAll: false,
      feed: [],
    },
    history: [],
    status: 'playing',
    winners: [],
  }
}
```

`apps/web/test/gameState.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { gameReducer, initialGameState, sectionFor, type GameState } from '../src/gameState'
import { makeView } from './fixtures'
import type { ServerMessage } from '@canasta/server/protocol'

const receive = (state: GameState, message: ServerMessage, joinFailed = false) =>
  gameReducer(state, { type: 'message', message, joinFailed })

describe('gameReducer', () => {
  it('records the seat, then the view, host and presence', () => {
    let state = gameReducer(initialGameState, { type: 'joining' })
    expect(state.joining).toBe(true)
    state = receive(state, { type: 'joined', code: 'ABCDEF', playerId: 'you', token: 't' })
    expect(state).toMatchObject({ playerId: 'you', joining: false })
    const view = makeView({ hand: [], phase: 'draw' })
    state = receive(state, { type: 'state', view, hostId: 'you', connected: ['you'] })
    expect(state).toMatchObject({ view, hostId: 'you', connected: ['you'] })
  })

  it('turns rule errors into toasts that link to their section', () => {
    const state = receive(initialGameState, {
      type: 'error',
      code: 'WILDS_EXCEED_NATURALS',
      message: 'Too many wilds.',
    })
    expect(state.toasts).toEqual([{ id: 1, message: 'Too many wilds.', section: 'melds' }])
  })

  it('gives protocol errors no section', () => {
    const state = receive(initialGameState, { type: 'error', code: 'NOT_HOST', message: 'No.' })
    expect(state.toasts[0].section).toBeNull()
  })

  it('ignores ROUND_NOT_OVER, which a second Next round press causes', () => {
    const state = receive(initialGameState, {
      type: 'error',
      code: 'ROUND_NOT_OVER',
      message: 'The next round can only start after this one is scored.',
    })
    expect(state).toBe(initialGameState)
  })

  it('shows a failed join on the join form, not as a toast', () => {
    const joining = gameReducer(initialGameState, { type: 'joining' })
    const state = receive(joining, { type: 'error', code: 'NAME_TAKEN', message: 'Taken.' }, true)
    expect(state).toMatchObject({ joining: false, joinError: 'Taken.', toasts: [] })
  })

  it('keeps rejoin tokens for the host and seat notices for everyone', () => {
    let state = receive(initialGameState, { type: 'reissued', playerId: 'bob', token: 'new' })
    state = receive(state, { type: 'seatReissued', playerId: 'bob' })
    expect(state.rejoinTokens).toEqual({ bob: 'new' })
    expect(state.notices).toEqual([{ id: 1, playerId: 'bob' }])
  })

  it('records removal and drops the seat', () => {
    const joined = receive(initialGameState, {
      type: 'joined',
      code: 'ABCDEF',
      playerId: 'you',
      token: 't',
    })
    expect(receive(joined, { type: 'removed', reason: 'kicked' })).toMatchObject({
      removed: 'kicked',
      playerId: null,
    })
  })
})

describe('sectionFor', () => {
  it('maps rule errors to rules sections and protocol errors to null', () => {
    expect(sectionFor('FROZEN_NEEDS_NATURAL_PAIR')).toBe('pickup')
    expect(sectionFor('BAD_MESSAGE')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @canasta/web`
Expected: FAIL, because `../src/gameState` can't be resolved.

- [ ] **Step 3: Implement the state and the hook**

`apps/web/src/gameState.ts`:
```ts
import { RULE_ERROR_SECTIONS, type PlayerView, type RuleSection } from '@canasta/engine'
import type { RemovedReason, ServerErrorCode, ServerMessage } from '@canasta/server/protocol'
import type { ConnectionStatus } from './connection'

export interface Toast {
  id: number
  message: string
  /** The rules-page anchor for a rule error. Protocol errors have none. */
  section: RuleSection | null
}

/** A seat got a new rejoin link. Kept only in memory: a player who reconnects misses it. */
export interface SeatNotice {
  id: number
  playerId: string
}

export interface GameState {
  connection: ConnectionStatus
  failures: number
  playerId: string | null
  /** A join was sent and has no answer yet. */
  joining: boolean
  view: PlayerView | null
  hostId: string | null
  connected: string[]
  /** Why the last join failed; the page shows the join form with it. */
  joinError: string | null
  toasts: Toast[]
  notices: SeatNotice[]
  /** Host only: the latest rejoin token for each reissued seat. */
  rejoinTokens: Record<string, string>
  removed: RemovedReason | null
  nextId: number
}

export type GameEvent =
  | { type: 'status'; status: ConnectionStatus; failures: number }
  /** `joinFailed`: this error answers a join that was in flight. */
  | { type: 'message'; message: ServerMessage; joinFailed: boolean }
  | { type: 'dismissToast'; id: number }
  | { type: 'joining' }

export const initialGameState: GameState = {
  connection: 'connecting',
  failures: 0,
  playerId: null,
  joining: false,
  view: null,
  hostId: null,
  connected: [],
  joinError: null,
  toasts: [],
  notices: [],
  rejoinTokens: {},
  removed: null,
  nextId: 1,
}

const MAX_TOASTS = 3
const MAX_NOTICES = 5

export function sectionFor(code: ServerErrorCode): RuleSection | null {
  return Object.hasOwn(RULE_ERROR_SECTIONS, code)
    ? RULE_ERROR_SECTIONS[code as keyof typeof RULE_ERROR_SECTIONS]
    : null
}

export function gameReducer(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    case 'status':
      return { ...state, connection: event.status, failures: event.failures }
    case 'joining':
      return { ...state, joining: true, joinError: null }
    case 'dismissToast':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== event.id) }
    case 'message':
      return onMessage(state, event.message, event.joinFailed)
  }
}

function onMessage(state: GameState, message: ServerMessage, joinFailed: boolean): GameState {
  switch (message.type) {
    case 'joined':
      return { ...state, playerId: message.playerId, joining: false, removed: null }
    case 'state':
      return { ...state, view: message.view, hostId: message.hostId, connected: message.connected }
    case 'error': {
      if (joinFailed) return { ...state, joining: false, joinError: message.message }
      // Two players can press Next round together; the second one's ROUND_NOT_OVER is noise.
      if (message.code === 'ROUND_NOT_OVER') return state
      const toast = {
        id: state.nextId,
        message: message.message,
        section: sectionFor(message.code),
      }
      return {
        ...state,
        toasts: [...state.toasts, toast].slice(-MAX_TOASTS),
        nextId: state.nextId + 1,
      }
    }
    case 'removed':
      return { ...state, removed: message.reason, playerId: null }
    case 'reissued':
      return {
        ...state,
        rejoinTokens: { ...state.rejoinTokens, [message.playerId]: message.token },
      }
    case 'seatReissued': {
      const notice = { id: state.nextId, playerId: message.playerId }
      return {
        ...state,
        notices: [notice, ...state.notices].slice(0, MAX_NOTICES),
        nextId: state.nextId + 1,
      }
    }
    case 'pong':
      return state
  }
}
```

`apps/web/src/useGame.ts`:
```ts
import type { ClientMessage } from '@canasta/server/protocol'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { socketUrl } from './api'
import { GameConnection } from './connection'
import { gameReducer, initialGameState, type GameState } from './gameState'
import { clearToken, loadName, loadToken, saveName, saveToken } from './storage'

export interface GameOptions {
  /** A token from a rejoin link. It is saved before the first connect. */
  linkToken: string | null
  /** Join with this name as soon as the socket opens (set by the home page). */
  autoJoinName: string | null
}

export interface GameControls {
  state: GameState
  join(name: string): void
  send(message: ClientMessage): void
  dismissToast(id: number): void
}

/**
 * Connects to one game. On every open it joins with the saved token, or with a name the player
 * gave, so a reconnect gets the same seat back.
 */
export function useGame(code: string, { linkToken, autoJoinName }: GameOptions): GameControls {
  const [state, dispatch] = useReducer(gameReducer, initialGameState)
  const connectionRef = useRef<GameConnection | null>(null)
  const pendingNameRef = useRef<string | null>(null)
  /** Set while a join is in flight; `withToken` says whether it used a saved token. */
  const joiningRef = useRef<{ withToken: boolean } | null>(null)
  const sendJoinRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (linkToken) saveToken(code, linkToken)
    pendingNameRef.current = autoJoinName

    const sendJoin = () => {
      const token = loadToken(code)
      const name = pendingNameRef.current ?? (loadName() || 'Player')
      if (!token && pendingNameRef.current === null) return
      const message: ClientMessage = token ? { type: 'join', name, token } : { type: 'join', name }
      if (!connection.send(message)) return
      joiningRef.current = { withToken: token !== null }
      dispatch({ type: 'joining' })
    }

    const connection = new GameConnection({
      url: socketUrl(code),
      onOpen: sendJoin,
      onStatus: (status, failures) => dispatch({ type: 'status', status, failures }),
      onMessage: (message) => {
        const joining = joiningRef.current
        const joinFailed = message.type === 'error' && joining !== null
        if (message.type === 'joined' || joinFailed) {
          joiningRef.current = null
          pendingNameRef.current = null
        }
        if (message.type === 'joined') saveToken(code, message.token)
        // A saved token that no longer works (the seat was reissued) is useless: forget it.
        if (joinFailed && joining?.withToken) clearToken(code)
        if (message.type === 'removed') {
          clearToken(code)
          connection.stop()
        }
        dispatch({ type: 'message', message, joinFailed })
      },
    })
    connectionRef.current = connection
    sendJoinRef.current = sendJoin
    connection.start()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') connection.check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      connection.stop()
      connectionRef.current = null
    }
  }, [code, linkToken, autoJoinName])

  const join = useCallback((name: string) => {
    saveName(name)
    pendingNameRef.current = name
    sendJoinRef.current()
  }, [])

  const send = useCallback((message: ClientMessage) => {
    connectionRef.current?.send(message)
  }, [])

  const dismissToast = useCallback((id: number) => dispatch({ type: 'dismissToast', id }), [])

  return { state, join, send, dismissToast }
}
```

Notes:
- The connection is created inside the effect, so React StrictMode's mount, unmount, mount cycle creates a second connection and fully stops the first.
- The effect's dependencies are stable: `GamePage` reads `linkToken` and `autoJoinName` once with `useState` initializers.
- Status dispatches happen in socket callbacks, never synchronously in the effect body, so `react-hooks/set-state-in-effect` doesn't fire.

- [ ] **Step 4: Implement the pages**

`apps/web/src/components/WhyLink.tsx`:
```tsx
import type { RuleSection } from '@canasta/engine'
import { Link } from 'react-router'

/** "Why?" for a rule error: a link to that rule's section of the rules page. */
export function WhyLink({ section }: { section: RuleSection }) {
  return <Link to={`/rules#${section}`}>Why?</Link>
}
```

`apps/web/src/components/Toasts.tsx`:
```tsx
import { useEffect } from 'react'
import type { Toast } from '../gameState'
import styles from './Toasts.module.css'
import { WhyLink } from './WhyLink'

const TOAST_MS = 6000

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: number) => void
}) {
  return (
    <div className={styles.toasts} role="alert" aria-live="assertive">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])
  return (
    <div className={styles.toast}>
      <span>{toast.message}</span> {toast.section && <WhyLink section={toast.section} />}
      <button type="button" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
        ×
      </button>
    </div>
  )
}
```

`Toasts.module.css`: a fixed stack in the bottom-right corner (`inset: auto 1rem 1rem auto`, `max-width: min(24rem, calc(100vw - 2rem))`), dark toasts with a gold "Why?" link and a borderless dismiss button:

`apps/web/src/components/Toasts.module.css`:
```css
.toasts {
  position: fixed;
  inset: auto 1rem 1rem auto;
  display: grid;
  gap: 0.5rem;
  z-index: 10;
  max-width: min(24rem, calc(100vw - 2rem));
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--ink);
  color: white;
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
  box-shadow: var(--shadow);
}

.toast a {
  color: var(--gold);
}

.toast button {
  margin-left: auto;
  min-height: 32px;
  background: none;
  color: inherit;
  border: none;
}
```

`apps/web/src/pages/HomePage.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { createGame, normalizeCode } from '../api'
import { loadName, saveName } from '../storage'
import type { GamePageState } from './GamePage'
import styles from './Pages.module.css'

export function HomePage() {
  const navigate = useNavigate()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [name, setName] = useState(loadName)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const trimmed = name.trim()

  const go = (gameCode: string) => {
    saveName(trimmed)
    navigate(`/g/${gameCode}`, { state: { join: trimmed } satisfies GamePageState })
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      go(await createGame())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a game.')
      setBusy(false)
    }
  }

  const joinByCode = (event: FormEvent) => {
    event.preventDefault()
    const normalized = normalizeCode(code)
    if (normalized) go(normalized)
    else setError('Game codes are 6 letters and numbers, like ABC234.')
  }

  return (
    <main className={styles.home}>
      <h1>Cutthroat Canasta</h1>
      {notice && <p className={styles.notice}>{notice}</p>}
      <label>
        Your name
        <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="button" disabled={!trimmed || busy} onClick={() => void create()}>
        Create a game
      </button>
      <form className={styles.join} onSubmit={joinByCode}>
        <label>
          Game code
          <input
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <button type="submit" disabled={!trimmed || code.trim().length === 0}>
          Join
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
      <Link to="/rules">Read the rules</Link>
    </main>
  )
}
```

`apps/web/src/pages/Lobby.tsx`:
```tsx
import type { ClientMessage } from '@canasta/server/protocol'
import type { PlayerView } from '@canasta/engine'
import { MIN_PLAYERS } from '@canasta/engine'
import styles from './Pages.module.css'

export interface LobbyProps {
  code: string
  view: PlayerView
  playerId: string
  hostId: string | null
  connected: string[]
  send: (message: ClientMessage) => void
}

export function Lobby({ code, view, playerId, hostId, connected, send }: LobbyProps) {
  const isHost = playerId === hostId
  const shareLink = `${window.location.origin}/g/${code}`
  return (
    <main className={styles.lobby}>
      <h1>Game {code}</h1>
      <p>
        Share the code or this link: <a href={shareLink}>{shareLink}</a>
      </p>
      <ul className={styles.seats}>
        {view.players.map((p) => (
          <li key={p.id}>
            <span className={connected.includes(p.id) ? styles.online : styles.offline} />
            {p.name}
            {p.id === hostId && ' (host)'}
            {p.id === playerId && ' (you)'}
            {isHost && p.id !== playerId && (
              <button type="button" onClick={() => send({ type: 'kick', playerId: p.id })}>
                Kick
              </button>
            )}
          </li>
        ))}
      </ul>
      {isHost ? (
        <button
          type="button"
          disabled={view.players.length < MIN_PLAYERS}
          onClick={() => send({ type: 'start' })}
        >
          Start game
        </button>
      ) : (
        <p>Waiting for the host to start.</p>
      )}
      <button type="button" onClick={() => send({ type: 'leave' })}>
        Leave
      </button>
    </main>
  )
}
```

`apps/web/src/pages/GamePage.tsx` (Task 8 replaces the "The game has started." placeholder with the table; Task 10 adds the rules drawer):

`apps/web/src/pages/GamePage.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { normalizeCode } from '../api'
import type { ConnectionStatus } from '../connection'
import { Toasts } from '../components/Toasts'
import { loadName, loadToken, tokenFromHash } from '../storage'
import { useGame } from '../useGame'
import { Lobby } from './Lobby'
import styles from './Pages.module.css'

/** Navigation state the home page passes: join with this name right away. */
export interface GamePageState {
  join?: string
}

/** After this many failed connects in a row, warn that the code may be wrong. */
const UNREACHABLE_AFTER = 3

export function GamePage() {
  const params = useParams()
  const code = normalizeCode(params.code ?? '')
  if (!code) {
    return (
      <main className={styles.home}>
        <p>That isn't a valid game code.</p>
        <Link to="/">Back to the start</Link>
      </main>
    )
  }
  return <Game key={code} code={code} />
}

function Game({ code }: { code: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  // Read once: the hash is removed below, and the name only applies to the first join.
  const [linkToken] = useState(() => tokenFromHash(location.hash))
  const [autoJoinName] = useState(() => (location.state as GamePageState | null)?.join ?? null)
  // With a token or a name the page joins by itself, so it shows "Joining…", not the form.
  const [joinsByItself] = useState(() => Boolean(linkToken || autoJoinName || loadToken(code)))
  const { state, join, send, dismissToast } = useGame(code, { linkToken, autoJoinName })

  useEffect(() => {
    // Keep the token out of the address bar, history and anything the player shares.
    if (location.hash) navigate({ pathname: location.pathname, hash: '' }, { replace: true })
  }, [location.hash, location.pathname, navigate])

  useEffect(() => {
    if (!state.removed) return
    const notice =
      state.removed === 'kicked' ? 'The host removed you from the game.' : 'You left the game.'
    navigate('/', { replace: true, state: { notice } })
  }, [state.removed, navigate])

  const view = state.view
  let body
  if (!state.playerId && (state.joining || (joinsByItself && !state.joinError))) {
    body = <p className={styles.banner}>Joining…</p>
  } else if (!state.playerId || !view) {
    body = (
      <JoinForm
        code={code}
        error={state.joinError}
        waiting={state.connection !== 'open'}
        onJoin={join}
      />
    )
  } else if (view.status === 'lobby') {
    body = (
      <Lobby
        code={code}
        view={view}
        playerId={state.playerId}
        hostId={state.hostId}
        connected={state.connected}
        send={send}
      />
    )
  } else {
    body = <p className={styles.banner}>The game has started.</p>
  }

  return (
    <>
      <ConnectionBanner connection={state.connection} failures={state.failures} code={code} />
      {body}
      <Toasts toasts={state.toasts} onDismiss={dismissToast} />
    </>
  )
}

function ConnectionBanner({
  connection,
  failures,
  code,
}: {
  connection: ConnectionStatus
  failures: number
  code: string
}) {
  if (connection === 'open') return null
  return (
    <p className={styles.banner} role="status">
      {failures >= UNREACHABLE_AFTER
        ? `Can't reach game ${code}. Check the code, or wait while we keep trying.`
        : connection === 'connecting'
          ? 'Connecting…'
          : 'Reconnecting…'}
    </p>
  )
}

function JoinForm({
  code,
  error,
  waiting,
  onJoin,
}: {
  code: string
  error: string | null
  waiting: boolean
  onJoin: (name: string) => void
}) {
  const [name, setName] = useState(loadName)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) onJoin(name.trim())
  }
  return (
    <main className={styles.home}>
      <h1>Join game {code}</h1>
      <form className={styles.join} onSubmit={submit}>
        <label>
          Your name
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={waiting || !name.trim()}>
          Join
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
    </main>
  )
}
```

`Pages.module.css`: a centered single column (`max-width: 28rem`) for the home, join and lobby screens; labels stacked over 44 px inputs; seat rows with green/grey presence dots; `.error`, `.notice` and `.banner` message styles; and a fixed top-right `.rulesButton` (used in Task 10):

`apps/web/src/pages/Pages.module.css`:
```css
.home,
.lobby {
  max-width: 28rem;
  margin: 0 auto;
  padding: 2rem 1rem;
  display: grid;
  gap: 1rem;
}

.home label,
.join label {
  display: grid;
  gap: 0.25rem;
}

.home input {
  font: inherit;
  min-height: 44px;
  padding: 0 0.5rem;
}

.join {
  display: flex;
  align-items: end;
  gap: 0.5rem;
}

.seats {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 0.5rem;
}

.seats li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.online,
.offline {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--ok);
}

.offline {
  background: #9aa0a6;
}

.error {
  color: var(--bad);
}

.notice {
  background: #fdf3d8;
  border-radius: var(--radius);
  padding: 0.5rem;
}

.banner {
  text-align: center;
  padding: 0.5rem;
  margin: 0;
  background: #fdf3d8;
}

.rulesButton {
  position: fixed;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 5;
}
```

`apps/web/src/App.tsx` (Task 10 adds the `/rules` route):
```tsx
import { Link, Route, Routes } from 'react-router'
import { GamePage } from './pages/GamePage'
import { HomePage } from './pages/HomePage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/g/:code" element={<GamePage />} />
      <Route path="*" element={<Link to="/">Page not found. Back to the start.</Link>} />
    </Routes>
  )
}
```

`apps/web/src/main.tsx`:

`apps/web/src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import './global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

Delete `apps/web/test/smoke.test.tsx` (it rendered the placeholder `App` without a router).

- [ ] **Step 5: Run all checks**

Run: `npm run format && npm test && npm run typecheck && npm run lint && npm run format:check`
Expected: 15 web tests pass (7 connection + 8 game state).

- [ ] **Step 6: Try the lobby by hand**

Run `npm run dev:server` in one terminal and `npm run dev:web` in another. (Vite logs `ECONNREFUSED` proxy errors until wrangler is up; that's expected.) Open `http://localhost:5173` in two browser profiles:
- Create a game as Ann; join it as Bob with the code. Both see both seats with green dots; Ann sees **Kick** and **Start game**.
- Bob presses **Leave**: he lands on `/` with "You left the game." Bob joins again; Ann kicks him: "The host removed you from the game."
- Ann presses **Start game** alone: a toast says "You need at least 2 players to start." with a "Why?" link to `/rules#setup`.
- Reload Ann's tab: she reconnects to her seat without the join form.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "Add game state, home page, join flow and lobby"
```

---

### Task 5: Cards and table panels

**Files:**
- Create: `apps/web/src/cards.ts`, `apps/web/src/components/Card.tsx`, `apps/web/src/components/Card.module.css`, `apps/web/src/components/Hand.tsx`, `apps/web/src/components/MeldList.tsx`, `apps/web/src/components/OpponentPanel.tsx`, `apps/web/src/components/CenterPile.tsx`, `apps/web/src/components/Table.module.css`
- Test: `apps/web/test/cards.test.ts`

**Interfaces:**
- Consumes: engine `Card`, `CardId`, `Meld`, `PublicPlayer`, `PlayerView`, `Rank`, `Suit`, `isCanasta`, `isNaturalCanasta`, `isPileFrozenFor`.
- Produces:
  - `cards.ts`: `SUIT_SYMBOLS`, `isRed(card)`, `cardLabel(card)` ("7♥", "Joker"), `cardName(card)` ("7 of hearts", accessible name), `sortHand(cards)` (Jokers, 2s, then A down to 4, then 3s; then suit, then id).
  - `Card({ card, selected?, size?, onClick? })`: a toggle `button` with `aria-pressed` when clickable, else `role="img"`; both are labelled with `cardName`. `CardRow({ cards, size? })`.
  - `Hand({ cards, selected, hidden, onToggle })`: the sorted hand, hiding staged cards.
  - `MeldList({ melds, red3s, onPick? })`: melds grouped by rank, finished canastas labelled "Natural canasta" or "Mixed canasta". With `onPick`, each meld is a button that stages the selection as an addition.
  - `OpponentPanel({ player, isTurn, isConnected, isHost, onReissue?, rejoinLink? })`: name, presence dot, host badge, card count, score, melds and Red 3s, and a gold outline on their turn. `RejoinControl`: host only, for a disconnected player; **Make rejoin link** sends `reissue`, then a read-only link field with **Copy** (the clipboard write happens on that click, so it has a user gesture).
  - `CenterPile({ view, yourTurn, selected, onToggleTop, onDraw })`: **Draw (n left)** (or **Stock empty: end the round** when `stockCount` is 0, spec 3.3), the top discard (selectable in your draw phase, for a pickup), the pile size, and a *Frozen for you* badge with the reason.

- [ ] **Step 1: Write the failing test**

`apps/web/test/cards.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { cardLabel, cardName, sortHand } from '../src/cards'
import { card } from './fixtures'

describe('card helpers', () => {
  it('labels and names cards', () => {
    expect(cardLabel(card('7h', 1))).toBe('7♥')
    expect(cardLabel(card('JK', 2))).toBe('Joker')
    expect(cardName(card('Qs', 3))).toBe('Queen of spades')
  })

  it('sorts a hand: wilds, then Ace down to 4, then 3s', () => {
    const hand = [
      card('4c', 1),
      card('3s', 2),
      card('Ah', 3),
      card('2d', 4),
      card('JK', 5),
      card('Kc', 6),
    ]
    expect(sortHand(hand).map(cardLabel)).toEqual(['Joker', '2♦', 'A♥', 'K♣', '4♣', '3♠'])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @canasta/web`
Expected: FAIL, because `../src/cards` can't be resolved.

- [ ] **Step 3: Implement**

`apps/web/src/cards.ts`:
```ts
import type { Card, Rank, Suit } from '@canasta/engine'

export const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
}

const RANK_NAMES: Record<Rank, string> = {
  A: 'Ace',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
  JOKER: 'Joker',
}

/** Hand order: wilds first, then Ace down to 4, then 3s. */
const RANK_ORDER: Rank[] = [
  'JOKER',
  '2',
  'A',
  'K',
  'Q',
  'J',
  '10',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
]
const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds']

export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds'
}

/** Short label for the feed and toasts, such as "7♥" or "Joker". */
export function cardLabel(card: Card): string {
  return card.suit ? `${card.rank}${SUIT_SYMBOLS[card.suit]}` : 'Joker'
}

/** Accessible name, such as "7 of hearts" or "Joker". */
export function cardName(card: Card): string {
  return card.suit ? `${RANK_NAMES[card.rank]} of ${card.suit}` : 'Joker'
}

export function sortHand(cards: readonly Card[]): Card[] {
  const suitIndex = (c: Card) => (c.suit ? SUIT_ORDER.indexOf(c.suit) : -1)
  return [...cards].sort(
    (a, b) =>
      RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank) ||
      suitIndex(a) - suitIndex(b) ||
      a.id - b.id,
  )
}
```

`apps/web/src/components/Card.tsx`:
```tsx
import type { Card as CardValue } from '@canasta/engine'
import { SUIT_SYMBOLS, cardName, isRed } from '../cards'
import styles from './Card.module.css'

export interface CardProps {
  card: CardValue
  selected?: boolean
  size?: 'normal' | 'small'
  /** Makes the card a toggle button. Without it the card is a picture. */
  onClick?: () => void
}

export function Card({ card, selected = false, size = 'normal', onClick }: CardProps) {
  const className = [
    styles.card,
    styles[size],
    isRed(card) ? styles.red : styles.black,
    selected ? styles.selected : '',
  ].join(' ')
  const face = card.suit ? (
    <>
      <span className={styles.rank}>{card.rank}</span>
      <span className={styles.suit}>{SUIT_SYMBOLS[card.suit]}</span>
    </>
  ) : (
    <span className={styles.joker}>★</span>
  )
  if (!onClick) {
    return (
      <span className={className} role="img" aria-label={cardName(card)}>
        {face}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={className}
      aria-label={cardName(card)}
      aria-pressed={selected}
      onClick={onClick}
    >
      {face}
    </button>
  )
}

export function CardRow({
  cards,
  size = 'small',
}: {
  cards: CardValue[]
  size?: 'normal' | 'small'
}) {
  return (
    <span className={styles.row}>
      {cards.map((c) => (
        <Card key={c.id} card={c} size={size} />
      ))}
    </span>
  )
}
```

`Card.module.css` (the card face is also used on the rules page, so it has a print rule):

`apps/web/src/components/Card.module.css`:
```css
.card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  border: 1px solid #c9c4b8;
  border-radius: 6px;
  background: white;
  box-shadow: var(--shadow);
  font-weight: 700;
  padding: 0;
  min-height: 0;
  line-height: 1;
  transition: transform 0.1s;
}

.normal {
  width: 3rem;
  height: 4.25rem;
  font-size: 1.1rem;
}

.small {
  width: 2.1rem;
  height: 3rem;
  font-size: 0.85rem;
}

.red {
  color: var(--red);
}

.black {
  color: var(--ink);
}

.selected {
  transform: translateY(-0.5rem);
  outline: 3px solid var(--gold);
}

.joker {
  font-size: 1.4em;
  color: #6a3fb5;
}

.row {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

@media print {
  .card {
    box-shadow: none;
  }
}
```

`apps/web/src/components/Hand.tsx`:
```tsx
import type { Card as CardValue, CardId } from '@canasta/engine'
import { sortHand } from '../cards'
import { Card } from './Card'
import styles from './Table.module.css'

export interface HandProps {
  cards: CardValue[]
  selected: readonly CardId[]
  /** Staged cards stay in the staging area, so the hand hides them. */
  hidden: ReadonlySet<CardId>
  onToggle: (cardId: CardId) => void
}

export function Hand({ cards, selected, hidden, onToggle }: HandProps) {
  return (
    <section className={styles.hand} aria-label="Your hand">
      {sortHand(cards)
        .filter((c) => !hidden.has(c.id))
        .map((c) => (
          <Card
            key={c.id}
            card={c}
            selected={selected.includes(c.id)}
            onClick={() => onToggle(c.id)}
          />
        ))}
    </section>
  )
}
```

`apps/web/src/components/MeldList.tsx`:
```tsx
import { isCanasta, isNaturalCanasta, type Card as CardValue, type Meld } from '@canasta/engine'
import { CardRow } from './Card'
import styles from './Table.module.css'

export interface MeldListProps {
  melds: Meld[]
  red3s: CardValue[]
  /** Your own melds: clicking one stages the selected cards as an addition to it. */
  onPick?: (meldId: string) => void
}

/** Melds grouped by rank, with finished canastas marked natural or mixed. */
export function MeldList({ melds, red3s, onPick }: MeldListProps) {
  const ordered = [...melds].sort(
    (a, b) => a.rank.localeCompare(b.rank) || a.id.localeCompare(b.id),
  )
  return (
    <div className={styles.melds}>
      {ordered.map((meld) => {
        const label = isCanasta(meld)
          ? isNaturalCanasta(meld)
            ? 'Natural canasta'
            : 'Mixed canasta'
          : `${meld.cards.length} cards`
        const body = (
          <>
            <span className={styles.meldLabel}>
              {meld.rank}s · {label}
            </span>
            <CardRow cards={meld.cards} />
          </>
        )
        return onPick ? (
          <button
            key={meld.id}
            type="button"
            className={styles.meld}
            aria-label={`Add selected cards to your ${meld.rank}s (${label})`}
            onClick={() => onPick(meld.id)}
          >
            {body}
          </button>
        ) : (
          <div key={meld.id} className={styles.meld}>
            {body}
          </div>
        )
      })}
      {red3s.length > 0 && (
        <div className={styles.meld}>
          <span className={styles.meldLabel}>Red 3s</span>
          <CardRow cards={red3s} />
        </div>
      )}
    </div>
  )
}
```

`apps/web/src/components/OpponentPanel.tsx`:
```tsx
import type { PublicPlayer } from '@canasta/engine'
import { MeldList } from './MeldList'
import styles from './Table.module.css'

export interface OpponentPanelProps {
  player: PublicPlayer
  isTurn: boolean
  isConnected: boolean
  isHost: boolean
  /** Host only, for a disconnected player: ask the server for a rejoin link. */
  onReissue?: () => void
  rejoinLink?: string
}

export function OpponentPanel(props: OpponentPanelProps) {
  const { player, isTurn, isConnected, isHost, onReissue, rejoinLink } = props
  return (
    <section
      className={`${styles.opponent} ${isTurn ? styles.turn : ''}`}
      aria-label={`${player.name}${isTurn ? ', playing now' : ''}`}
    >
      <header>
        <span
          className={isConnected ? styles.online : styles.offline}
          title={isConnected ? 'Connected' : 'Not connected'}
        />
        <strong>{player.name}</strong>
        {isHost && <span className={styles.badge}>Host</span>}
        <span>{player.handCount} cards</span>
        <span>{player.score.toLocaleString('en-US')} pts</span>
      </header>
      <MeldList melds={player.melds} red3s={player.red3s} />
      {onReissue && !isConnected && <RejoinControl onReissue={onReissue} link={rejoinLink} />}
    </section>
  )
}

export function RejoinControl({ onReissue, link }: { onReissue: () => void; link?: string }) {
  if (!link) {
    return (
      <button type="button" onClick={onReissue}>
        Make rejoin link
      </button>
    )
  }
  return (
    <div className={styles.rejoin}>
      <input
        readOnly
        value={link}
        aria-label="Rejoin link"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" onClick={() => void navigator.clipboard?.writeText(link)}>
        Copy
      </button>
    </div>
  )
}
```

`apps/web/src/components/CenterPile.tsx`:
```tsx
import { isPileFrozenFor, type CardId, type PlayerView } from '@canasta/engine'
import { Card } from './Card'
import styles from './Table.module.css'

export interface CenterPileProps {
  view: PlayerView
  yourTurn: boolean
  selected: readonly CardId[]
  onToggleTop: (cardId: CardId) => void
  onDraw: () => void
}

export function CenterPile({ view, yourTurn, selected, onToggleTop, onDraw }: CenterPileProps) {
  const round = view.round!
  const top = round.discardTop
  const canDraw = yourTurn && round.phase === 'draw'
  const frozenReason = view.you
    ? round.pileFrozenForAll
      ? 'a wild is in the pile'
      : !view.you.hasPickedUpPile
        ? "you haven't picked it up this round"
        : null
    : null
  const frozen =
    view.you !== null &&
    isPileFrozenFor(view.you, { top, pileFrozenForAll: round.pileFrozenForAll })
  return (
    <section className={styles.center} aria-label="Stock and discard pile">
      <button type="button" className={styles.stock} disabled={!canDraw} onClick={onDraw}>
        {round.stockCount > 0 ? `Draw (${round.stockCount} left)` : 'Stock empty: end the round'}
      </button>
      <div className={styles.pile}>
        {top ? (
          <Card
            card={top}
            selected={selected.includes(top.id)}
            onClick={canDraw ? () => onToggleTop(top.id) : undefined}
          />
        ) : (
          <span className={styles.empty}>Empty pile</span>
        )}
        <span>{round.discardCount} in pile</span>
        {frozen && frozenReason && (
          <span className={styles.frozen} title={`Frozen because ${frozenReason}`}>
            Frozen for you: {frozenReason}
          </span>
        )}
      </div>
    </section>
  )
}
```

`Table.module.css` lays out the table as a grid on felt green: opponents across the top (a horizontal scroller), the pile and the feed in the middle row, and your area at the bottom; below 700 px it becomes one column (opponents, pile, feed, you). The key rules:
```css
.table {
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18rem;
  grid-template-areas:
    'opponents opponents'
    'center feed'
    'you you';
  gap: 1rem;
  padding: 1rem;
  background: var(--felt);
  color: white;
}

.opponents {
  grid-area: opponents;
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
}

.turn {
  outline: 3px solid var(--gold);
}

@media (max-width: 700px) {
  .table {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'opponents' 'center' 'feed' 'you';
    padding: 0.5rem;
  }
}
```
Define every class the components use: `table`, `opponents`, `opponent`, `you`, `turn`, `online`, `offline`, `badge`, `rejoin`, `center`, `stock`, `pile`, `empty`, `frozen`, `feed`, `notice`, `melds`, `meld`, `meldLabel`, `hand`, `roundEnd`, `gameOver`, `breakdown`, `totals`. Melds are dashed-outline boxes that inherit the text color (they are buttons for your own melds); `.frozen` is a pale-blue pill; `.roundEnd` and `.gameOver` span the full width on a paper background.

- [ ] **Step 4: Run all checks**

Run: `npm run format && npm test && npm run typecheck && npm run lint && npm run format:check`
Expected: 17 web tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "Add card component and table panels"
```

---

### Task 6: Staging area

**Files:**
- Create: `apps/web/src/staging.ts`, `apps/web/src/components/StagingArea.tsx`, `apps/web/src/components/StagingArea.module.css`
- Test: `apps/web/test/staging.test.ts`, `apps/web/test/StagingArea.test.tsx`

**Interfaces:**
- Consumes: engine `legalityPreview`, `RULE_ERROR_SECTIONS`, `Action`, `CardId`, `MeldBatch`, `PlayerView`, `RuleError`; `Card`, `Hand`, `MeldList`, `CenterPile` (Task 5); `WhyLink` (Task 4).
- Produces:
  - `staging.ts`: `interface StagedGroup { meldId: string | null; cardIds }`, `interface Staging { selected; groups }`, `type StagingAction` (`toggle`, `stageNew`, `stageAdd`, `unstage`, `clear`), `emptyStaging`, `interface Available`, `availableIn(view)`, `stagedIds(staging)`, `reconcile(staging, available)`, `stagingReducer(staging, action)`, `toBatch(staging)`, `type StagingPreview`, `stagingPreview(view, staging)`, `useStaging(view): [Staging, dispatch]`.
  - `StagingArea({ view, staging, dispatch, onAction })`.

How staging works:
- Clicking a hand card (or the top discard during your draw phase) toggles it in `selected`.
- **New meld** moves the selection into a new-meld group. Clicking one of your melds moves the selection into an addition to that meld. Clicking a staged card returns it to your hand.
- The batch is the staged groups plus the current selection as one more new meld, so the common case (select three cards, press **Meld**) needs no staging step.
- The preview picks the action from the phase: in the draw phase, `pickUpPile` with the batch; in the play phase, `discard` when exactly one card is selected and nothing is staged, else `meld`. It calls `legalityPreview(view, action)`. **Meld**, **Pick up pile** and **Discard** are enabled only when the preview is that action and it is legal; **Clear** when anything is selected or staged. The illegal message shows with a "Why?" link to `RULE_ERROR_SECTIONS[code]`.
- Pressing an action sends exactly the previewed `Action` and clears the staging.
- `useStaging` stores raw state and derives the rendered state with `reconcile`, so cards that left your hand (played, discarded, or the top discard after the draw phase) drop out without an effect. Each dispatch reconciles first, so stale ids never come back. The table remounts per round (Task 8), which resets staging, because card ids repeat across rounds.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/staging.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  emptyStaging,
  reconcile,
  stagingPreview,
  stagingReducer,
  toBatch,
  type Staging,
  type StagingAction,
} from '../src/staging'
import { card, makeView } from './fixtures'

const run = (...actions: StagingAction[]): Staging => actions.reduce(stagingReducer, emptyStaging)

describe('staging reducer', () => {
  it('toggles selection and stages it as a new meld', () => {
    const staging = run(
      { type: 'toggle', cardId: 1 },
      { type: 'toggle', cardId: 2 },
      { type: 'toggle', cardId: 2 },
      { type: 'toggle', cardId: 3 },
      { type: 'stageNew' },
    )
    expect(staging).toEqual({ selected: [], groups: [{ meldId: null, cardIds: [1, 3] }] })
  })

  it('merges additions to the same meld and ignores staged cards when toggled', () => {
    const staging = run(
      { type: 'toggle', cardId: 1 },
      { type: 'stageAdd', meldId: 'm1' },
      { type: 'toggle', cardId: 1 },
      { type: 'toggle', cardId: 2 },
      { type: 'stageAdd', meldId: 'm1' },
    )
    expect(staging.groups).toEqual([{ meldId: 'm1', cardIds: [1, 2] }])
    expect(staging.selected).toEqual([])
  })

  it('unstages a card and drops groups that become empty', () => {
    const staging = run(
      { type: 'toggle', cardId: 1 },
      { type: 'stageNew' },
      { type: 'unstage', cardId: 1 },
    )
    expect(staging).toEqual(emptyStaging)
  })

  it('builds a batch from groups plus the current selection', () => {
    const staging = run(
      { type: 'toggle', cardId: 1 },
      { type: 'stageAdd', meldId: 'm1' },
      { type: 'toggle', cardId: 2 },
      { type: 'toggle', cardId: 3 },
      { type: 'stageNew' },
      { type: 'toggle', cardId: 4 },
    )
    expect(toBatch(staging)).toEqual({
      newMelds: [[2, 3], [4]],
      additions: [{ meldId: 'm1', cardIds: [1] }],
    })
  })
})

describe('reconcile', () => {
  it('drops cards that left the hand and additions to melds that are gone', () => {
    const staging: Staging = {
      selected: [1, 9],
      groups: [
        { meldId: 'gone', cardIds: [2] },
        { meldId: null, cardIds: [3, 8] },
      ],
    }
    const next = reconcile(staging, { cardIds: new Set([1, 2, 3]), meldIds: new Set() })
    expect(next).toEqual({ selected: [1], groups: [{ meldId: null, cardIds: [3] }] })
  })

  it('returns the same object when nothing changed', () => {
    const staging: Staging = { selected: [1], groups: [] }
    expect(reconcile(staging, { cardIds: new Set([1]), meldIds: new Set() })).toBe(staging)
  })
})

describe('stagingPreview', () => {
  const nines = [card('9h', 1), card('9s', 2), card('9d', 3)]

  it('previews a meld in the play phase', () => {
    const view = makeView({ hand: [...nines, card('4c', 4), card('5c', 5)], phase: 'play' })
    const preview = stagingPreview(view, { selected: [1, 2, 3], groups: [] })
    expect(preview).toMatchObject({ kind: 'meld', error: { code: 'INITIAL_MELD_TOO_LOW' } })
  })

  it('treats one selected card in the play phase as a discard', () => {
    const view = makeView({ hand: nines, phase: 'play' })
    expect(stagingPreview(view, { selected: [2], groups: [] })).toMatchObject({
      kind: 'discard',
      action: { type: 'discard', cardId: 2 },
      error: null,
    })
  })

  it('previews a pickup in the draw phase', () => {
    const view = makeView({
      hand: [card('9s', 2), card('9d', 3)],
      phase: 'draw',
      top: card('9h', 1),
    })
    expect(stagingPreview(view, { selected: [1, 2, 3], groups: [] })).toMatchObject({
      kind: 'pickUpPile',
      error: { code: 'INITIAL_MELD_TOO_LOW' },
    })
  })

  it('shows nothing when nothing is selected', () => {
    expect(stagingPreview(makeView({ hand: nines, phase: 'play' }), emptyStaging)).toEqual({
      kind: 'none',
    })
  })
})
```

`apps/web/test/StagingArea.test.tsx`:
```tsx
import type { Action, PlayerView } from '@canasta/engine'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CenterPile } from '../src/components/CenterPile'
import { Hand } from '../src/components/Hand'
import { MeldList } from '../src/components/MeldList'
import { StagingArea } from '../src/components/StagingArea'
import { stagedIds, useStaging } from '../src/staging'
import { card, makeView } from './fixtures'

/** The table's staging wiring: hand, your melds, the pile, and the staging area. */
function Harness({ view, onAction }: { view: PlayerView; onAction: (action: Action) => void }) {
  const [staging, dispatch] = useStaging(view)
  return (
    <MemoryRouter>
      <CenterPile
        view={view}
        yourTurn
        selected={staging.selected}
        onToggleTop={(cardId) => dispatch({ type: 'toggle', cardId })}
        onDraw={() => {}}
      />
      <MeldList
        melds={view.you!.melds}
        red3s={[]}
        onPick={(meldId) => dispatch({ type: 'stageAdd', meldId })}
      />
      <StagingArea view={view} staging={staging} dispatch={dispatch} onAction={onAction} />
      <Hand
        cards={view.you!.hand}
        selected={staging.selected}
        hidden={stagedIds(staging)}
        onToggle={(cardId) => dispatch({ type: 'toggle', cardId })}
      />
    </MemoryRouter>
  )
}

function setup(view: PlayerView) {
  const onAction = vi.fn()
  render(<Harness view={view} onAction={onAction} />)
  const user = userEvent.setup()
  const click = (name: string | RegExp) => user.click(screen.getByRole('button', { name }))
  return { onAction, click }
}

const button = (name: string) => screen.getByRole('button', { name })

describe('StagingArea', () => {
  it('previews an illegal meld with a Why? link and keeps Meld disabled', async () => {
    const view = makeView({
      phase: 'play',
      hand: [
        card('9h', 1),
        card('9s', 2),
        card('2c', 3),
        card('2d', 4),
        card('JK', 5),
        card('4c', 6),
      ],
      score: -100,
    })
    const { click } = setup(view)
    for (const name of ['9 of hearts', '9 of spades', '2 of clubs', '2 of diamonds', 'Joker']) {
      await click(name)
    }
    expect(screen.getByRole('status')).toHaveTextContent("Wild cards can't outnumber natural cards")
    expect(screen.getByRole('link', { name: 'Why?' })).toHaveAttribute('href', '/rules#melds')
    expect(button('Meld')).toBeDisabled()
  })

  it('sends a legal meld and clears the staging area', async () => {
    const view = makeView({
      phase: 'play',
      hand: [card('Ah', 1), card('As', 2), card('Ad', 3), card('4c', 4), card('5c', 5)],
    })
    const { click, onAction } = setup(view)
    await click('Ace of hearts')
    await click('Ace of spades')
    await click('Ace of diamonds')
    expect(screen.getByRole('status')).toHaveTextContent('Legal meld.')
    await click('Meld')
    expect(onAction).toHaveBeenCalledWith({
      type: 'meld',
      play: { newMelds: [[1, 2, 3]], additions: [] },
    })
    expect(screen.getByRole('status')).toHaveTextContent('Select cards from your hand.')
  })

  it('stages a new meld and an addition to an existing meld in one play', async () => {
    const view = makeView({
      phase: 'play',
      melds: [{ id: 'm1', rank: 'K', cards: [card('Kh', 10), card('Kd', 11), card('Ks', 12)] }],
      hand: [
        card('Kc', 1),
        card('7h', 2),
        card('7s', 3),
        card('7d', 4),
        card('4c', 5),
        card('5c', 6),
      ],
    })
    const { click, onAction } = setup(view)
    await click('King of clubs')
    await click(/Add selected cards to your Ks/)
    await click('7 of hearts')
    await click('7 of spades')
    await click('7 of diamonds')
    await click('New meld')
    expect(screen.getByText('New meld', { selector: 'span' })).toBeInTheDocument()
    await click('Meld')
    expect(onAction).toHaveBeenCalledWith({
      type: 'meld',
      play: { newMelds: [[2, 3, 4]], additions: [{ meldId: 'm1', cardIds: [1] }] },
    })
  })

  it('picks up the pile with the top discard and a natural pair', async () => {
    const view = makeView({
      phase: 'draw',
      top: card('Qh', 1),
      score: -100,
      hand: [card('Qs', 2), card('Qd', 3), card('4c', 4), card('5c', 5)],
    })
    const { click, onAction } = setup(view)
    expect(button('Pick up pile')).toBeDisabled()
    await click('Queen of hearts')
    await click('Queen of spades')
    await click('Queen of diamonds')
    await click('Pick up pile')
    expect(onAction).toHaveBeenCalledWith({
      type: 'pickUpPile',
      play: { newMelds: [[1, 2, 3]], additions: [] },
    })
  })

  it('discards a single selected card', async () => {
    const view = makeView({ phase: 'play', hand: [card('4c', 1), card('5c', 2), card('6c', 3)] })
    const { click, onAction } = setup(view)
    await click('5 of clubs')
    expect(button('Meld')).toBeDisabled()
    await click('Discard')
    expect(onAction).toHaveBeenCalledWith({ type: 'discard', cardId: 2 })
  })

  it('clears the selection', async () => {
    const view = makeView({ phase: 'play', hand: [card('4c', 1), card('5c', 2)] })
    const { click } = setup(view)
    await click('4 of clubs')
    expect(button('4 of clubs')).toHaveAttribute('aria-pressed', 'true')
    await click('Clear')
    expect(button('4 of clubs')).toHaveAttribute('aria-pressed', 'false')
    expect(button('Clear')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @canasta/web`
Expected: FAIL, because `../src/staging` and `../src/components/StagingArea` can't be resolved.

- [ ] **Step 3: Implement**

`apps/web/src/staging.ts`:
```ts
import {
  legalityPreview,
  type Action,
  type CardId,
  type MeldBatch,
  type PlayerView,
  type RuleError,
} from '@canasta/engine'
import { useState } from 'react'

/** Cards staged as one new meld (`meldId: null`) or as an addition to one of your melds. */
export interface StagedGroup {
  meldId: string | null
  cardIds: CardId[]
}

export interface Staging {
  /** Selected but not yet staged. They also count as one more new meld in the batch. */
  selected: CardId[]
  groups: StagedGroup[]
}

export type StagingAction =
  | { type: 'toggle'; cardId: CardId }
  | { type: 'stageNew' }
  | { type: 'stageAdd'; meldId: string }
  | { type: 'unstage'; cardId: CardId }
  | { type: 'clear' }

export const emptyStaging: Staging = { selected: [], groups: [] }

/** What the player may stage right now: their hand, plus the top discard during the draw phase. */
export interface Available {
  cardIds: ReadonlySet<CardId>
  meldIds: ReadonlySet<string>
}

export function availableIn(view: PlayerView): Available {
  const you = view.you
  const round = view.round
  const cardIds = new Set<CardId>(you?.hand.map((c) => c.id) ?? [])
  if (round?.phase === 'draw' && round.discardTop) cardIds.add(round.discardTop.id)
  return { cardIds, meldIds: new Set(you?.melds.map((m) => m.id) ?? []) }
}

export function stagedIds(staging: Staging): Set<CardId> {
  return new Set(staging.groups.flatMap((g) => g.cardIds))
}

/** Drops cards and melds that are gone (played, discarded, or a new phase). */
export function reconcile(staging: Staging, available: Available): Staging {
  const keep = (id: CardId) => available.cardIds.has(id)
  const selected = staging.selected.filter(keep)
  const groups = staging.groups
    .filter((g) => g.meldId === null || available.meldIds.has(g.meldId))
    .map((g) => ({ ...g, cardIds: g.cardIds.filter(keep) }))
    .filter((g) => g.cardIds.length > 0)
  const unchanged =
    selected.length === staging.selected.length &&
    groups.length === staging.groups.length &&
    groups.every((g, i) => g.cardIds.length === staging.groups[i].cardIds.length)
  return unchanged ? staging : { selected, groups }
}

export function stagingReducer(staging: Staging, action: StagingAction): Staging {
  switch (action.type) {
    case 'toggle': {
      if (stagedIds(staging).has(action.cardId)) return staging
      const selected = staging.selected.includes(action.cardId)
        ? staging.selected.filter((id) => id !== action.cardId)
        : [...staging.selected, action.cardId]
      return { ...staging, selected }
    }
    case 'stageNew':
      if (staging.selected.length === 0) return staging
      return {
        selected: [],
        groups: [...staging.groups, { meldId: null, cardIds: staging.selected }],
      }
    case 'stageAdd': {
      if (staging.selected.length === 0) return staging
      const existing = staging.groups.find((g) => g.meldId === action.meldId)
      const groups = existing
        ? staging.groups.map((g) =>
            g === existing ? { ...g, cardIds: [...g.cardIds, ...staging.selected] } : g,
          )
        : [...staging.groups, { meldId: action.meldId, cardIds: staging.selected }]
      return { selected: [], groups }
    }
    case 'unstage': {
      const groups = staging.groups
        .map((g) => ({ ...g, cardIds: g.cardIds.filter((id) => id !== action.cardId) }))
        .filter((g) => g.cardIds.length > 0)
      return { ...staging, groups }
    }
    case 'clear':
      return emptyStaging
  }
}

/** The staged groups, plus any selected cards as one more new meld. */
export function toBatch(staging: Staging): MeldBatch {
  const newMelds = staging.groups.filter((g) => g.meldId === null).map((g) => g.cardIds)
  if (staging.selected.length > 0) newMelds.push(staging.selected)
  const additions = staging.groups
    .filter((g): g is StagedGroup & { meldId: string } => g.meldId !== null)
    .map((g) => ({ meldId: g.meldId, cardIds: g.cardIds }))
  return { newMelds, additions }
}

export type StagingPreview =
  | { kind: 'none' }
  | { kind: 'meld' | 'pickUpPile' | 'discard'; action: Action; error: RuleError | null }

/**
 * The action the staged cards describe, checked with the engine's `legalityPreview`:
 * - draw phase: picking up the pile with the batch (it must include the top discard)
 * - play phase, one selected card and nothing staged: discarding it
 * - play phase otherwise: melding the batch
 */
export function stagingPreview(view: PlayerView, staging: Staging): StagingPreview {
  const round = view.round
  if (!view.you || !round || view.status !== 'playing') return { kind: 'none' }
  const batch = toBatch(staging)
  const empty = batch.newMelds.length === 0 && batch.additions.length === 0
  let action: Action
  if (round.phase === 'draw') {
    if (empty) return { kind: 'none' }
    action = { type: 'pickUpPile', play: batch }
  } else if (staging.groups.length === 0 && staging.selected.length === 1) {
    action = { type: 'discard', cardId: staging.selected[0] }
  } else {
    if (empty) return { kind: 'none' }
    action = { type: 'meld', play: batch }
  }
  return {
    kind: action.type as 'meld' | 'pickUpPile' | 'discard',
    action,
    error: legalityPreview(view, action),
  }
}

/** Staging state that stays in step with the view: cards that left your hand drop out. */
export function useStaging(view: PlayerView): [Staging, (action: StagingAction) => void] {
  const [raw, setRaw] = useState(emptyStaging)
  const available = availableIn(view)
  const staging = reconcile(raw, available)
  const dispatch = (action: StagingAction) =>
    setRaw((current) => stagingReducer(reconcile(current, available), action))
  return [staging, dispatch]
}
```

`apps/web/src/components/StagingArea.tsx`:
```tsx
import { RULE_ERROR_SECTIONS, type Action, type PlayerView } from '@canasta/engine'
import { stagingPreview, type Staging, type StagingAction } from '../staging'
import { Card } from './Card'
import { WhyLink } from './WhyLink'
import styles from './StagingArea.module.css'

export interface StagingAreaProps {
  view: PlayerView
  staging: Staging
  dispatch: (action: StagingAction) => void
  onAction: (action: Action) => void
}

export function StagingArea({ view, staging, dispatch, onAction }: StagingAreaProps) {
  const preview = stagingPreview(view, staging)
  const you = view.you
  const top = view.round?.discardTop
  const cardById = new Map([...(you?.hand ?? []), ...(top ? [top] : [])].map((c) => [c.id, c]))
  const meldName = (meldId: string) => {
    const meld = you?.melds.find((m) => m.id === meldId)
    return meld ? `Add to your ${meld.rank}s` : 'Add to meld'
  }
  const ready = (kind: 'meld' | 'pickUpPile' | 'discard') =>
    preview.kind === kind && preview.error === null
  const run = () => {
    if (preview.kind === 'none') return
    onAction(preview.action)
    dispatch({ type: 'clear' })
  }
  const nothingStaged = staging.selected.length === 0 && staging.groups.length === 0

  return (
    <section className={styles.staging} aria-label="Staging area">
      <div className={styles.groups}>
        {staging.groups.map((group, i) => (
          <div key={i} className={styles.group}>
            <span className={styles.groupLabel}>
              {group.meldId === null ? 'New meld' : meldName(group.meldId)}
            </span>
            {group.cardIds.map((id) => {
              const card = cardById.get(id)
              return card ? (
                <Card
                  key={id}
                  card={card}
                  size="small"
                  onClick={() => dispatch({ type: 'unstage', cardId: id })}
                />
              ) : null
            })}
          </div>
        ))}
      </div>

      <p className={styles.preview} role="status">
        {preview.kind === 'none' ? (
          'Select cards from your hand.'
        ) : preview.error ? (
          <>
            <span className={styles.illegal}>{preview.error.message}</span>{' '}
            <WhyLink section={RULE_ERROR_SECTIONS[preview.error.code]} />
          </>
        ) : (
          <span className={styles.legal}>{legalText(preview.kind)}</span>
        )}
      </p>

      <div className={styles.buttons}>
        <button
          type="button"
          disabled={staging.selected.length === 0}
          onClick={() => dispatch({ type: 'stageNew' })}
        >
          New meld
        </button>
        <button type="button" disabled={!ready('meld')} onClick={run}>
          Meld
        </button>
        <button type="button" disabled={!ready('pickUpPile')} onClick={run}>
          Pick up pile
        </button>
        <button type="button" disabled={!ready('discard')} onClick={run}>
          Discard
        </button>
        <button type="button" disabled={nothingStaged} onClick={() => dispatch({ type: 'clear' })}>
          Clear
        </button>
      </div>
    </section>
  )
}

function legalText(kind: 'meld' | 'pickUpPile' | 'discard'): string {
  if (kind === 'meld') return 'Legal meld.'
  if (kind === 'pickUpPile') return 'You can pick up the pile with this play.'
  return 'You can discard this card.'
}
```

`StagingArea.module.css`: `.staging` is a paper-colored panel with dark text above the hand; `.groups` is a wrapping flex row of `.group` boxes (dashed border, a small `.groupLabel` over the cards); `.preview` is one line, `min-height: 1.5em` so the layout doesn't jump, with `.legal` green and `.illegal` red; `.buttons` is a wrapping flex row with `gap: 0.5rem`.

- [ ] **Step 4: Run all checks**

Run: `npm run format && npm test && npm run typecheck && npm run lint && npm run format:check`
Expected: 33 web tests pass (17 + 10 staging + 6 staging area).

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "Add the staging area with live legality preview"
```

---

### Task 7: Feed, round-end scoreboard and game over

**Files:**
- Create: `apps/web/src/feed.ts`, `apps/web/src/components/Feed.tsx`, `apps/web/src/components/BreakdownTable.tsx`, `apps/web/src/components/RoundEnd.tsx`, `apps/web/src/components/GameOver.tsx`
- Test: `apps/web/test/feed.test.ts`

**Interfaces:**
- Consumes: engine `FeedEvent`, `Played`, `PublicPlayer`, `PlayerView`, `ScoreBreakdown`; `SeatNotice` (Task 4); `CardRow` (Task 5).
- Produces:
  - `describeEvent(event, players): string`, for example "Ann picked up 9 cards, melding 9♥ 9♠ 9♦". `pickedUpPile.count` already includes the top card, so it's shown as is.
  - `Feed({ events, notices, players })`: seat notices first ("The host made a rejoin link for Bob's seat."), then the last 8 events, newest first.
  - `BreakdownTable({ names, breakdowns })`: one row per line of spec 3.8, the hand penalty shown negative. The rules page reuses it (Task 9).
  - `RoundEnd({ view, onNextRound? })`: reads `view.history.at(-1)`: how the round ended, every breakdown, each player's cumulative score, and each revealed hand from `hands`. Every player sees **Next round**.
  - `GameOver({ view })`: the winner, or "Ann and Bob share the win!" for a tie, and a table of every round's total from `view.history` plus final totals.

- [ ] **Step 1: Write the failing test**

`apps/web/test/feed.test.ts`:
```ts
import type { FeedEvent, PublicPlayer } from '@canasta/engine'
import { describe, expect, it } from 'vitest'
import { describeEvent } from '../src/feed'
import { card } from './fixtures'

const players: PublicPlayer[] = [
  { id: 'a', name: 'Ann', score: 0, handCount: 0, melds: [], red3s: [], turnsThisRound: 1 },
]

describe('describeEvent', () => {
  const cases: [FeedEvent, string][] = [
    [{ type: 'drewStock', playerId: 'a', red3s: [] }, 'Ann drew a card'],
    [{ type: 'drewStock', playerId: 'a', red3s: [card('3h', 1)] }, 'Ann drew and laid down 3♥'],
    [
      {
        type: 'pickedUpPile',
        playerId: 'a',
        count: 9,
        played: { newMelds: [[card('9h', 1), card('9s', 2), card('9d', 3)]], additions: [] },
      },
      'Ann picked up 9 cards, melding 9♥ 9♠ 9♦',
    ],
    [{ type: 'discarded', playerId: 'a', card: card('7h', 1) }, 'Ann discarded 7♥'],
    [{ type: 'wentOut', playerId: 'a' }, 'Ann went out'],
    [{ type: 'stockOut' }, 'The stock ran out. The round is over.'],
  ]

  it.each(cases)('%j', (event, text) => {
    expect(describeEvent(event, players)).toBe(text)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w @canasta/web`
Expected: FAIL, because `../src/feed` can't be resolved.

- [ ] **Step 3: Implement**

`apps/web/src/feed.ts`:
```ts
import type { FeedEvent, Played, PublicPlayer } from '@canasta/engine'
import { cardLabel } from './cards'

function playedCards(played: Played): string {
  return [...played.newMelds.flat(), ...played.additions.flatMap((a) => a.cards)]
    .map(cardLabel)
    .join(' ')
}

/** One line for the action feed, such as "Ann picked up 9 cards". */
export function describeEvent(event: FeedEvent, players: readonly PublicPlayer[]): string {
  if (event.type === 'stockOut') return 'The stock ran out. The round is over.'
  const name = players.find((p) => p.id === event.playerId)?.name ?? 'Someone'
  switch (event.type) {
    case 'drewStock':
      return event.red3s.length === 0
        ? `${name} drew a card`
        : `${name} drew and laid down ${event.red3s.map(cardLabel).join(' ')}`
    case 'pickedUpPile':
      // `count` includes the top card, which went straight into a meld.
      return `${name} picked up ${event.count} cards, melding ${playedCards(event.played)}`
    case 'melded':
      return `${name} melded ${playedCards(event.played)}`
    case 'discarded':
      return `${name} discarded ${cardLabel(event.card)}`
    case 'wentOut':
      return `${name} went out`
  }
}
```

`apps/web/src/components/Feed.tsx`:
```tsx
import type { PublicPlayer } from '@canasta/engine'
import type { FeedEvent } from '@canasta/engine'
import { describeEvent } from '../feed'
import type { SeatNotice } from '../gameState'
import styles from './Table.module.css'

const SHOWN = 8

export function Feed({
  events,
  notices,
  players,
}: {
  events: FeedEvent[]
  notices: SeatNotice[]
  players: PublicPlayer[]
}) {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'a player'
  return (
    <section className={styles.feed} aria-label="What happened">
      {notices.map((n) => (
        <p key={n.id} className={styles.notice} role="status">
          The host made a rejoin link for {nameOf(n.playerId)}'s seat.
        </p>
      ))}
      <ol reversed>
        {events
          .slice(-SHOWN)
          .reverse()
          .map((event, i) => (
            <li key={events.length - i}>{describeEvent(event, players)}</li>
          ))}
      </ol>
    </section>
  )
}
```

`apps/web/src/components/BreakdownTable.tsx`:
```tsx
import type { ScoreBreakdown } from '@canasta/engine'
import styles from './Table.module.css'

/** One column per player, one row per line of the round-scoring rule (spec 3.8). */
const BREAKDOWN_ROWS: { key: keyof ScoreBreakdown; label: string; sign?: -1 }[] = [
  { key: 'meldPoints', label: 'Cards in melds' },
  { key: 'canastaBonus', label: 'Canasta bonuses' },
  { key: 'red3Points', label: 'Red 3s' },
  { key: 'goingOutBonus', label: 'Going out' },
  { key: 'concealedBonus', label: 'Concealed hand' },
  { key: 'handPenalty', label: 'Cards left in hand', sign: -1 },
  { key: 'total', label: 'Round total' },
]

export function BreakdownTable({
  names,
  breakdowns,
}: {
  names: string[]
  breakdowns: ScoreBreakdown[]
}) {
  return (
    <table className={styles.breakdown}>
      <thead>
        <tr>
          <th scope="col">Score</th>
          {names.map((name) => (
            <th key={name} scope="col">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {BREAKDOWN_ROWS.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.label}</th>
            {breakdowns.map((b, i) => (
              <td key={i}>{(row.sign ?? 1) * b[row.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

`apps/web/src/components/RoundEnd.tsx`:
```tsx
import type { PlayerView } from '@canasta/engine'
import { BreakdownTable } from './BreakdownTable'
import { CardRow } from './Card'
import styles from './Table.module.css'

export interface RoundEndProps {
  view: PlayerView
  onNextRound?: () => void
}

/** The last round's breakdowns and revealed hands, read from `view.history`. */
export function RoundEnd({ view, onNextRound }: RoundEndProps) {
  const last = view.history.at(-1)
  if (!last) return null
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? 'Someone'
  return (
    <section className={styles.roundEnd} aria-label={`Round ${last.round} scores`}>
      <h2>Round {last.round}</h2>
      <p>
        {last.endedBy === 'goingOut' && last.wentOut
          ? `${nameOf(last.wentOut)} went out.`
          : 'The stock ran out.'}
      </p>
      <BreakdownTable
        names={view.players.map((p) => p.name)}
        breakdowns={view.players.map((p) => last.breakdown[p.id])}
      />
      <table className={styles.totals}>
        <tbody>
          {view.players.map((p) => (
            <tr key={p.id}>
              <th scope="row">{p.name}</th>
              <td>{p.score.toLocaleString('en-US')}</td>
              <td>
                <CardRow cards={last.hands[p.id] ?? []} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {onNextRound && (
        <button type="button" onClick={onNextRound}>
          Next round
        </button>
      )}
    </section>
  )
}
```

`apps/web/src/components/GameOver.tsx`:
```tsx
import type { PlayerView } from '@canasta/engine'
import { Link } from 'react-router'
import styles from './Table.module.css'

export function GameOver({ view }: { view: PlayerView }) {
  const names = view.winners.map((id) => view.players.find((p) => p.id === id)?.name ?? '?')
  const ranked = [...view.players].sort((a, b) => b.score - a.score)
  return (
    <section className={styles.gameOver} aria-label="Game over">
      <h2>{names.length > 1 ? `${names.join(' and ')} share the win!` : `${names[0]} wins!`}</h2>
      <table className={styles.totals}>
        <thead>
          <tr>
            <th scope="col">Player</th>
            {view.history.map((r) => (
              <th key={r.round} scope="col">
                R{r.round}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((p) => (
            <tr key={p.id}>
              <th scope="row">{p.name}</th>
              {view.history.map((r) => (
                <td key={r.round}>{r.breakdown[p.id]?.total ?? 0}</td>
              ))}
              <td>{p.score.toLocaleString('en-US')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link to="/">New game</Link>
    </section>
  )
}
```

- [ ] **Step 4: Run all checks**

Run: `npm run format && npm test && npm run typecheck && npm run lint && npm run format:check`
Expected: 39 web tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "Add the action feed, round-end scoreboard and game-over screen"
```

---

### Task 8: Assemble the table and playtest

**Files:**
- Create: `apps/web/src/pages/Table.tsx`
- Modify: `apps/web/src/pages/GamePage.tsx`

**Interfaces:**
- Consumes: everything from Tasks 4–7.
- Produces: `Table({ code, view, state, send })`, and `GamePage` shows it once the game has started.

- [ ] **Step 1: Implement**

`apps/web/src/pages/Table.tsx`:
```tsx
import type { Action, PlayerView } from '@canasta/engine'
import type { ClientMessage } from '@canasta/server/protocol'
import { rejoinLink } from '../api'
import { CenterPile } from '../components/CenterPile'
import { Feed } from '../components/Feed'
import { GameOver } from '../components/GameOver'
import { Hand } from '../components/Hand'
import { MeldList } from '../components/MeldList'
import { OpponentPanel } from '../components/OpponentPanel'
import { RoundEnd } from '../components/RoundEnd'
import { StagingArea } from '../components/StagingArea'
import styles from '../components/Table.module.css'
import type { GameState } from '../gameState'
import { stagedIds, useStaging } from '../staging'

export interface TableProps {
  code: string
  view: PlayerView
  state: GameState
  send: (message: ClientMessage) => void
}

export function Table({ code, view, state, send }: TableProps) {
  const [staging, dispatch] = useStaging(view)
  const round = view.round!
  const you = view.you!
  const currentId = view.players[round.current]?.id
  const yourTurn = view.status === 'playing' && currentId === you.id
  const isHost = state.playerId === state.hostId
  const act = (action: Action) => send({ type: 'action', action })

  return (
    <main className={styles.table}>
      <div className={styles.opponents}>
        {view.players
          .filter((p) => p.id !== you.id)
          .map((p) => {
            const token = state.rejoinTokens[p.id]
            return (
              <OpponentPanel
                key={p.id}
                player={p}
                isTurn={p.id === currentId && view.status === 'playing'}
                isConnected={state.connected.includes(p.id)}
                isHost={p.id === state.hostId}
                onReissue={isHost ? () => send({ type: 'reissue', playerId: p.id }) : undefined}
                rejoinLink={token ? rejoinLink(code, token) : undefined}
              />
            )
          })}
      </div>

      <CenterPile
        view={view}
        yourTurn={yourTurn}
        selected={staging.selected}
        onToggleTop={(cardId) => dispatch({ type: 'toggle', cardId })}
        onDraw={() => act({ type: 'drawStock' })}
      />

      <Feed events={round.feed} notices={state.notices} players={view.players} />

      {view.status === 'roundOver' && (
        <RoundEnd view={view} onNextRound={() => send({ type: 'nextRound' })} />
      )}
      {view.status === 'gameOver' && <GameOver view={view} />}

      <section className={`${styles.you} ${yourTurn ? styles.turn : ''}`} aria-label="You">
        <header>
          <strong>{you.name}</strong> · {you.score.toLocaleString('en-US')} pts ·{' '}
          {yourTurn
            ? round.phase === 'draw'
              ? 'Your turn: draw or pick up the pile'
              : 'Your turn: meld, then discard'
            : `Waiting for ${view.players[round.current]?.name ?? '…'}`}
        </header>
        <MeldList
          melds={you.melds}
          red3s={you.red3s}
          onPick={(meldId) => dispatch({ type: 'stageAdd', meldId })}
        />
        {view.status === 'playing' && (
          <StagingArea view={view} staging={staging} dispatch={dispatch} onAction={act} />
        )}
        <Hand
          cards={you.hand}
          selected={staging.selected}
          hidden={stagedIds(staging)}
          onToggle={(cardId) => dispatch({ type: 'toggle', cardId })}
        />
      </section>
    </main>
  )
}
```

In `GamePage.tsx`, add `import { Table } from './Table'` and replace the placeholder branch:
```tsx
  } else {
    body = <Table key={view.round?.number} code={code} view={view} state={state} send={send} />
  }
```
The `key` remounts the table each round, which resets the staging (card ids repeat between rounds).

- [ ] **Step 2: Run all checks and inspect the bundle**

Run: `npm run format && npm test && npm run typecheck && npm run lint && npm run format:check && npm run build -w @canasta/web`
Then: `grep -lE 'zod|parseClientMessage' apps/web/dist/assets/*.js`
Expected: all checks pass, the build succeeds (about 310 kB of JS, 98 kB gzipped), and the grep prints nothing.

- [ ] **Step 3: Playtest**

With `npm run dev:server` and `npm run dev:web` running, play with two browser profiles, plus a phone-width window (375 px) for one of them. Check each item and note anything that doesn't hold in your report:
- Draw from the stock; pick up the pile with a natural pair (select the top discard and two hand cards, then **Pick up pile**); meld; add to a meld by clicking it; discard.
- An illegal play (3 naturals below the initial minimum) shows the engine message and a "Why?" link; the buttons stay disabled.
- Pressing an action out of turn is impossible (disabled), and a stale-view rule error from the server appears as a toast.
- The feed shows events newest first; the frozen badge appears with its reason.
- Close Bob's tab: Ann sees Bob's grey dot. As host, **Make rejoin link**; both players see the seat notice in the feed area; open the link in a fresh profile: it rejoins Bob's seat, and the address bar shows `/g/CODE` without the hash. Bob's old token (another tab) now shows the join form with the engine's "Players can only join before the game starts."
- Play to a round end (or leave the stock short in a long game): the scoreboard shows every breakdown and revealed hand; both players press **Next round** together, and no error toast appears.
- In devtools, set the network to offline for 60 s, then online: the banner says "Reconnecting…", then the table comes back with the same seat.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "Assemble the table from its panels"
```

---

### Task 9: Rules examples as engine-checked data, and rules tables

**Files:**
- Create: `packages/engine/src/examples.ts`, `apps/web/src/rules/sections.ts`, `apps/web/src/rules/tables.ts`, `apps/web/src/rules/RuleExample.tsx`, `apps/web/src/rules/Rules.module.css`
- Modify: `packages/engine/package.json`
- Test: `packages/engine/test/examples.test.ts`, `apps/web/test/tables.test.ts`, `apps/web/test/RuleExample.test.tsx`

**Interfaces:**
- Consumes: engine `checkMeldCards`, `isCanasta`, `isNaturalCanasta` (meldRules), `checkPickupShape`, `PileState` (pileRules), `scoreRound` (scoring), `RULE_ERROR_SECTIONS`, the constants.
- Produces:
  - `@canasta/engine/examples`: `MeldExample`, `PickupExample`, `ScoringExample`, `ScoringExamplePlayer`, `RulesExample`, `RULES_EXAMPLES`, `exampleCards(codes, firstId?)`, `buildMeld(example)`, `buildPickup(example)`, `buildScoringPlayers(example)`. It is a separate package export, not part of the main index, so the server never sees it.
  - `rules/sections.ts`: `type PageSection = RuleSection | 'overview' | 'quick-reference' | 'house-rules'` and `PAGE_SECTIONS` (the spec Section 7 order; a `satisfies Record<RuleSection, string>` fails the typecheck if the engine adds a section the page lacks).
  - `rules/tables.ts`: `cardValueRows()`, `initialMeldRows()`, `tableSizeRows()`, all computed from `CARD_VALUES`, `INITIAL_MELD_TIERS`, `deckCount`, `handSize`, `MIN_PLAYERS` and `MAX_PLAYERS`.
  - `RuleExample({ example })`: a `figure` with the title, a **Legal** / **Not allowed** verdict, the cards drawn with `CardRow`, and the caption; scoring examples show each player's cards and a `BreakdownTable` of the expected breakdown.

The examples cover spec Section 7's list: valid and invalid melds (the spec's own 3N+2J+1D and 2N+2D+1J cases), frozen and unfrozen pickups, the canasta-can't-take-the-pile case, a Black 3 blocking the pile, a wild freezing the pile for everyone, a full three-player round breakdown (going out, both canasta bonuses, Red 3 bonus and penalty, hand penalty), and a concealed going-out with a pickup on that turn. Each non-scoring example's `section` must be the section its expected error links to (checked by the test).

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/examples.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import {
  RULES_EXAMPLES,
  buildMeld,
  buildPickup,
  buildScoringPlayers,
  type MeldExample,
  type PickupExample,
  type ScoringExample,
} from '../src/examples'
import { RULE_ERROR_SECTIONS } from '../src/errors'
import { checkMeldCards, isCanasta, isNaturalCanasta } from '../src/meldRules'
import { checkPickupShape } from '../src/pileRules'
import { scoreRound } from '../src/scoring'

const byKind = <K extends RulesKind>(kind: K) =>
  RULES_EXAMPLES.filter(
    (e): e is Extract<(typeof RULES_EXAMPLES)[number], { kind: K }> => e.kind === kind,
  )
type RulesKind = (typeof RULES_EXAMPLES)[number]['kind']

describe('rules page examples', () => {
  it('have unique ids', () => {
    const ids = RULES_EXAMPLES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('put each expected error under the section it links to', () => {
    for (const example of RULES_EXAMPLES) {
      if (example.kind === 'scoring' || example.expected === null) continue
      expect(RULE_ERROR_SECTIONS[example.expected], example.id).toBe(example.section)
    }
  })

  it.each(byKind('meld').map((e) => [e.id, e] as const))('meld %s', (_, example: MeldExample) => {
    const { after } = buildMeld(example)
    expect(checkMeldCards(after)?.code ?? null).toBe(example.expected)
    if (example.canasta !== undefined) {
      const meld = { id: 'm', rank: 'K' as const, cards: after }
      const kind = !isCanasta(meld) ? null : isNaturalCanasta(meld) ? 'natural' : 'mixed'
      expect(kind).toBe(example.canasta)
    }
  })

  it.each(byKind('pickup').map((e) => [e.id, e] as const))(
    'pickup %s',
    (_, example: PickupExample) => {
      const { player, pile, batch, meldCards } = buildPickup(example)
      const error = checkPickupShape(player, pile, batch) ?? checkMeldCards(meldCards)
      expect(error?.code ?? null).toBe(example.expected)
    },
  )

  it.each(byKind('scoring').map((e) => [e.id, e] as const))(
    'scoring %s',
    (_, example: ScoringExample) => {
      expect(scoreRound(buildScoringPlayers(example), example.wentOut)).toEqual(example.expected)
    },
  )
})
```

`apps/web/test/tables.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { cardValueRows, initialMeldRows, tableSizeRows } from '../src/rules/tables'

describe('rules tables', () => {
  it('group card values from the engine', () => {
    expect(cardValueRows().map((r) => [r.cards, r.points])).toEqual([
      ['Joker', 50],
      ['2', 20],
      ['A', 20],
      ['K, Q, J, 10, 9, 8', 10],
      ['7, 6, 5, 4', 5],
      ['Black 3', 5],
    ])
  })

  it('label the initial meld tiers', () => {
    expect(initialMeldRows()).toEqual([
      { score: 'Below 0', minimum: 15 },
      { score: '0 – 1,495', minimum: 50 },
      { score: '1,500 – 2,995', minimum: 90 },
      { score: '3,000 or more', minimum: 120 },
    ])
  })

  it('group player counts by decks and hand size', () => {
    expect(tableSizeRows()).toEqual([
      { players: '2', decks: 2, hand: 15 },
      { players: '3–4', decks: 2, hand: 13 },
      { players: '5–6', decks: 3, hand: 13 },
      { players: '7–8', decks: 4, hand: 13 },
    ])
  })
})
```

`apps/web/test/RuleExample.test.tsx`:
```tsx
import { RULES_EXAMPLES } from '@canasta/engine/examples'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RuleExample } from '../src/rules/RuleExample'

describe('RuleExample', () => {
  it.each(RULES_EXAMPLES.filter((e) => e.kind !== 'scoring').map((e) => [e.id, e] as const))(
    '%s shows its verdict and its cards',
    (_, example) => {
      const { container } = render(<RuleExample example={example} />)
      const figure = within(container.querySelector('figure')!)
      expect(figure.getByText(example.title)).toBeInTheDocument()
      expect(
        figure.getByText(example.expected === null ? 'Legal' : 'Not allowed'),
      ).toBeInTheDocument()
      expect(figure.getAllByRole('img').length).toBeGreaterThanOrEqual(1)
    },
  )

  it('shows every player’s breakdown for a scoring example', () => {
    const example = RULES_EXAMPLES.find((e) => e.id === 'scoring-round')!
    render(<RuleExample example={example} />)
    const total = screen.getByRole('row', { name: /Round total/ })
    expect(
      within(total)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['1195', '190', '-120'])
    expect(screen.getByRole('row', { name: /Cards left in hand/ })).toHaveTextContent('-25')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @canasta/engine && npm test -w @canasta/web`
Expected: FAIL, because `../src/examples`, `../src/rules/tables` and `../src/rules/RuleExample` can't be resolved.

- [ ] **Step 3: Add the engine module**

In `packages/engine/package.json`, change `exports` to:
```json
  "exports": {
    ".": "./src/index.ts",
    "./examples": "./src/examples.ts"
  },
```

`packages/engine/src/examples.ts`:
```ts
import type { Card, Rank, Suit } from './cards'
import type { RuleErrorCode, RuleSection } from './errors'
import type { PileState } from './pileRules'
import type { MeldBatch, Meld, Player, ScoreBreakdown } from './types'

/**
 * Worked examples for the rules page. Each one states the result the engine must give, and
 * `test/examples.test.ts` checks every example against `meldRules`, `pileRules` and `scoring`.
 * Cards are written as codes: 'Kh' is the king of hearts, '10s' the ten of spades, 'JK' a joker.
 */
interface ExampleBase {
  id: string
  section: RuleSection
  title: string
  caption: string
}

export interface MeldExample extends ExampleBase {
  kind: 'meld'
  /** An existing meld that `cards` are added to. Omit for a new meld. */
  existing?: string
  cards: string
  expected: RuleErrorCode | null
  /** What the meld is after the play, when the play is legal. */
  canasta?: 'natural' | 'mixed' | null
}

export interface PickupExample extends ExampleBase {
  kind: 'pickup'
  top: string
  /** The cards from hand that go into the play with the top discard. */
  hand: string
  /** The player's melds before the pickup. */
  melds: string[]
  hasPickedUpPile: boolean
  wildInPile: boolean
  /** 'new': the top card and `hand` start a new meld. A number: they join `melds[n]`. */
  target: 'new' | number
  expected: RuleErrorCode | null
}

export interface ScoringExamplePlayer {
  name: string
  melds: string[]
  red3s: string
  hand: string
  meldedBeforeThisTurn: boolean
}

export interface ScoringExample extends ExampleBase {
  kind: 'scoring'
  players: ScoringExamplePlayer[]
  /** The name of the player who went out, or null if the stock ran out. */
  wentOut: string | null
  expected: Record<string, ScoreBreakdown>
}

export type RulesExample = MeldExample | PickupExample | ScoringExample

const SUIT_CODES: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' }

/** Builds cards from codes. Ids count up from `firstId`, so each example's cards are distinct. */
export function exampleCards(codes: string, firstId = 0): Card[] {
  const trimmed = codes.trim()
  if (trimmed === '') return []
  return trimmed.split(/\s+/).map((code, i) => {
    const id = firstId + i
    if (code === 'JK') return { id, rank: 'JOKER', suit: null }
    const suit = SUIT_CODES[code.slice(-1)]
    if (!suit) throw new Error(`Bad card code: ${code}`)
    return { id, rank: code.slice(0, -1) as Rank, suit }
  })
}

function exampleMeld(codes: string, index: number): Meld {
  const cards = exampleCards(codes, 1000 + index * 100)
  const natural = cards.find((c) => c.rank !== '2' && c.rank !== 'JOKER')
  if (!natural) throw new Error(`Example meld needs a natural card: ${codes}`)
  return { id: `x${index}`, rank: natural.rank as Meld['rank'], cards }
}

function examplePlayer(overrides: Partial<Player>): Player {
  return {
    id: 'you',
    name: 'You',
    score: 0,
    hand: [],
    melds: [],
    red3s: [],
    hasPickedUpPile: false,
    turnsThisRound: 2,
    meldedBeforeThisTurn: true,
    ...overrides,
  }
}

/** A meld example as engine values: the cards before the play and the cards after it. */
export function buildMeld(example: MeldExample): { before: Card[]; added: Card[]; after: Card[] } {
  const before = example.existing ? exampleCards(example.existing, 0) : []
  const added = exampleCards(example.cards, 100)
  return { before, added, after: [...before, ...added] }
}

/** A pickup example as engine values, ready for `checkPickupShape` and `checkMeldCards`. */
export function buildPickup(example: PickupExample): {
  player: Player
  pile: PileState
  top: Card
  batch: MeldBatch
  /** The meld that holds the top discard after the play. */
  meldCards: Card[]
} {
  const [top] = exampleCards(example.top, 0)
  const hand = exampleCards(example.hand, 100)
  const melds = example.melds.map(exampleMeld)
  const player = examplePlayer({ hand, melds, hasPickedUpPile: example.hasPickedUpPile })
  const cardIds = [top.id, ...hand.map((c) => c.id)]
  if (example.target === 'new') {
    return {
      player,
      pile: { top, pileFrozenForAll: example.wildInPile },
      top,
      batch: { newMelds: [cardIds], additions: [] },
      meldCards: [top, ...hand],
    }
  }
  const target = melds[example.target]
  return {
    player,
    pile: { top, pileFrozenForAll: example.wildInPile },
    top,
    batch: { newMelds: [], additions: [{ meldId: target.id, cardIds }] },
    meldCards: [...target.cards, top, ...hand],
  }
}

/** A scoring example's players as engine players; each player's id is their name. */
export function buildScoringPlayers(example: ScoringExample): Player[] {
  return example.players.map((p, i) =>
    examplePlayer({
      id: p.name,
      name: p.name,
      melds: p.melds.map((codes, j) => exampleMeld(codes, i * 10 + j)),
      red3s: exampleCards(p.red3s, 5000 + i * 100),
      hand: exampleCards(p.hand, 6000 + i * 100),
      meldedBeforeThisTurn: p.meldedBeforeThisTurn,
    }),
  )
}

export const RULES_EXAMPLES: RulesExample[] = [
  {
    kind: 'meld',
    id: 'meld-natural',
    section: 'melds',
    title: 'A natural meld',
    caption: 'Three or more cards of one rank.',
    cards: '9h 9s 9d',
    expected: null,
  },
  {
    kind: 'meld',
    id: 'meld-wilds-equal',
    section: 'melds',
    title: 'Wilds may equal the naturals',
    caption: 'Three naturals and three wilds (two Jokers and a 2) is legal.',
    cards: '9h 9s 9d JK JK 2c',
    expected: null,
  },
  {
    kind: 'meld',
    id: 'meld-too-many-wilds',
    section: 'melds',
    title: 'Too many wilds',
    caption: 'Two naturals and three wilds: 2s count as wilds too, so this is illegal.',
    cards: '9h 9s 2c 2d JK',
    expected: 'WILDS_EXCEED_NATURALS',
  },
  {
    kind: 'meld',
    id: 'meld-two-naturals',
    section: 'melds',
    title: 'At least two naturals',
    caption: 'One natural with two wilds is not a meld.',
    cards: '9h 2c JK',
    expected: 'MELD_NEEDS_TWO_NATURALS',
  },
  {
    kind: 'meld',
    id: 'meld-threes',
    section: 'melds',
    title: '3s never meld',
    caption: 'Black 3s (and Red 3s) can never be melded, even when going out.',
    cards: '3c 3s 3c',
    expected: 'THREES_NOT_MELDABLE',
  },
  {
    kind: 'meld',
    id: 'meld-canasta-goes-mixed',
    section: 'melds',
    title: 'A wild makes a natural canasta mixed',
    caption: 'Adding a 2 to a natural canasta of Kings is legal, but it now scores 300, not 500.',
    existing: 'Kh Kd Ks Kc Kh Kd Ks',
    cards: '2c',
    expected: null,
    canasta: 'mixed',
  },
  {
    kind: 'pickup',
    id: 'pickup-frozen-pair',
    section: 'pickup',
    title: 'Frozen: a natural pair takes it',
    caption:
      'You have not picked up the pile yet this round, so it is frozen for you. A natural pair of 8s from your hand takes the 8.',
    top: '8h',
    hand: '8s 8d',
    melds: [],
    hasPickedUpPile: false,
    wildInPile: false,
    target: 'new',
    expected: null,
  },
  {
    kind: 'pickup',
    id: 'pickup-frozen-wild',
    section: 'pickup',
    title: 'Frozen: a natural and a wild is not enough',
    caption: 'While the pile is frozen for you, the pair from your hand must be natural.',
    top: '8h',
    hand: '8s JK',
    melds: [],
    hasPickedUpPile: false,
    wildInPile: false,
    target: 'new',
    expected: 'FROZEN_NEEDS_NATURAL_PAIR',
  },
  {
    kind: 'pickup',
    id: 'pickup-unfrozen-wild',
    section: 'pickup',
    title: 'Unfrozen: a natural and a wild works',
    caption:
      'You picked up the pile earlier this round and no wild is in it, so a natural plus a wild takes the 8.',
    top: '8h',
    hand: '8s JK',
    melds: [],
    hasPickedUpPile: true,
    wildInPile: false,
    target: 'new',
    expected: null,
  },
  {
    kind: 'pickup',
    id: 'pickup-unfrozen-add',
    section: 'pickup',
    title: 'Unfrozen: add it to your meld',
    caption:
      'When the pile is not frozen for you, the top card can join your unfinished meld of 8s.',
    top: '8h',
    hand: '',
    melds: ['8c 8d 8s'],
    hasPickedUpPile: true,
    wildInPile: false,
    target: 0,
    expected: null,
  },
  {
    kind: 'pickup',
    id: 'pickup-canasta',
    section: 'pickup',
    title: "A canasta can't take the pile",
    caption:
      'Your 5s are a finished canasta, so the discarded 5 cannot join them. Start a new meld of 5s from your hand instead.',
    top: '5h',
    hand: '',
    melds: ['5c 5d 5s 5h 5c 5d 5s'],
    hasPickedUpPile: true,
    wildInPile: false,
    target: 0,
    expected: 'CANASTA_CANNOT_TAKE_PILE',
  },
  {
    kind: 'pickup',
    id: 'pickup-wild-in-pile',
    section: 'pickup',
    title: 'A wild in the pile freezes it for everyone',
    caption:
      'Even after your first pickup, a wild anywhere in the pile means you need a natural pair from your hand.',
    top: '8h',
    hand: '',
    melds: ['8c 8d 8s'],
    hasPickedUpPile: true,
    wildInPile: true,
    target: 0,
    expected: 'FROZEN_NEEDS_NATURAL_PAIR',
  },
  {
    kind: 'pickup',
    id: 'pickup-black-3',
    section: 'pickup',
    title: 'A Black 3 on top blocks the pile',
    caption: 'Nobody can pick up the pile while a Black 3 or a wild is on top.',
    top: '3s',
    hand: '3c 3c',
    melds: [],
    hasPickedUpPile: true,
    wildInPile: false,
    target: 'new',
    expected: 'PILE_BLOCKED',
  },
  {
    kind: 'scoring',
    id: 'scoring-round',
    section: 'scoring',
    title: 'Scoring a round',
    caption:
      'Ann went out after melding on an earlier turn. Bob made melds but still holds cards. Cat never melded, so her Red 3 counts against her.',
    players: [
      {
        name: 'Ann',
        melds: ['Kh Kd Ks Kc Kh Kd Ks', '7h 7d 7s 7c 7h 2c JK', '9h 9d 9s'],
        red3s: '3h',
        hand: '',
        meldedBeforeThisTurn: true,
      },
      {
        name: 'Bob',
        melds: ['5h 5d 5s'],
        red3s: '3d 3h',
        hand: 'Ah 3c',
        meldedBeforeThisTurn: true,
      },
      { name: 'Cat', melds: [], red3s: '3d', hand: '4c 4d 10s', meldedBeforeThisTurn: false },
    ],
    wentOut: 'Ann',
    expected: {
      Ann: {
        meldPoints: 195,
        canastaBonus: 800,
        red3Points: 100,
        goingOutBonus: 100,
        concealedBonus: 0,
        handPenalty: 0,
        total: 1195,
      },
      Bob: {
        meldPoints: 15,
        canastaBonus: 0,
        red3Points: 200,
        goingOutBonus: 0,
        concealedBonus: 0,
        handPenalty: 25,
        total: 190,
      },
      Cat: {
        meldPoints: 0,
        canastaBonus: 0,
        red3Points: -100,
        goingOutBonus: 0,
        concealedBonus: 0,
        handPenalty: 20,
        total: -120,
      },
    },
  },
  {
    kind: 'scoring',
    id: 'scoring-concealed',
    section: 'going-out',
    title: 'Going out concealed',
    caption:
      'Dee had not melded at all this round, then picked up the pile and went out in one turn. She still earns the 200 concealed bonus.',
    players: [
      {
        name: 'Dee',
        melds: ['Qh Qd Qs Qc Qh Qd Qs', 'Ah Ad 2s'],
        red3s: '',
        hand: '',
        meldedBeforeThisTurn: false,
      },
    ],
    wentOut: 'Dee',
    expected: {
      Dee: {
        meldPoints: 130,
        canastaBonus: 500,
        red3Points: 0,
        goingOutBonus: 100,
        concealedBonus: 200,
        handPenalty: 0,
        total: 930,
      },
    },
  },
]
```

- [ ] **Step 4: Add the web rules modules**

`apps/web/src/rules/sections.ts`:
```ts
import type { RuleSection } from '@canasta/engine'

/** Rules-page anchors: every RuleSection, plus pages sections no error links to. */
export type PageSection = RuleSection | 'overview' | 'quick-reference' | 'house-rules'

const RULE_SECTION_TITLES = {
  setup: 'Setup',
  'card-values': 'Card values',
  turn: 'Your turn',
  melds: 'Melds and canastas',
  'initial-meld': 'Initial meld',
  pickup: 'Picking up the pile',
  'going-out': 'Going out',
  scoring: 'Scoring',
  winning: 'Winning',
} as const satisfies Record<RuleSection, string>

/** Table-of-contents order (spec Section 7). */
export const PAGE_SECTIONS: { id: PageSection; title: string }[] = [
  { id: 'quick-reference', title: 'Quick reference' },
  { id: 'overview', title: 'Overview' },
  ...(Object.entries(RULE_SECTION_TITLES) as [RuleSection, string][]).map(([id, title]) => ({
    id,
    title,
  })),
  { id: 'house-rules', title: 'Our house rules vs. standard Canasta' },
]
```

`apps/web/src/rules/tables.ts`:
```ts
import {
  CARD_VALUES,
  INITIAL_MELD_TIERS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  deckCount,
  handSize,
  type Rank,
} from '@canasta/engine'

const NATURAL_RANKS: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4']
const fmt = (n: number) => n.toLocaleString('en-US')

export interface ValueRow {
  cards: string
  role: string
  points: number
}

/** Card values, straight from CARD_VALUES. Naturals with equal values share a row. */
export function cardValueRows(): ValueRow[] {
  const naturals: ValueRow[] = []
  for (const rank of NATURAL_RANKS) {
    const last = naturals.at(-1)
    if (last && last.points === CARD_VALUES[rank]) last.cards += `, ${rank}`
    else naturals.push({ cards: rank, role: 'Natural', points: CARD_VALUES[rank] })
  }
  return [
    { cards: 'Joker', role: 'Wild', points: CARD_VALUES.JOKER },
    { cards: '2', role: 'Wild', points: CARD_VALUES['2'] },
    ...naturals,
    { cards: 'Black 3', role: 'Stop card, never meldable', points: CARD_VALUES['3'] },
  ]
}

/** Initial meld minimums from INITIAL_MELD_TIERS. Scores are always multiples of 5. */
export function initialMeldRows(): { score: string; minimum: number }[] {
  return INITIAL_MELD_TIERS.map((tier, i) => {
    const from = INITIAL_MELD_TIERS[i - 1]?.below
    const score =
      from === undefined || from === null
        ? `Below ${fmt(tier.below ?? 0)}`
        : tier.below === null
          ? `${fmt(from)} or more`
          : `${fmt(from)} – ${fmt(tier.below - 5)}`
    return { score, minimum: tier.minimum }
  })
}

/** Decks and hand size for each player count, from deckCount and handSize. */
export function tableSizeRows(): { players: string; decks: number; hand: number }[] {
  const rows: { from: number; to: number; decks: number; hand: number }[] = []
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    const last = rows.at(-1)
    if (last && last.decks === deckCount(n) && last.hand === handSize(n)) last.to = n
    else rows.push({ from: n, to: n, decks: deckCount(n), hand: handSize(n) })
  }
  return rows.map((r) => ({
    players: r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`,
    decks: r.decks,
    hand: r.hand,
  }))
}
```

`apps/web/src/rules/RuleExample.tsx`:
```tsx
import type { Card as CardValue } from '@canasta/engine'
import {
  buildMeld,
  buildPickup,
  buildScoringPlayers,
  type MeldExample,
  type PickupExample,
  type RulesExample,
  type ScoringExample,
} from '@canasta/engine/examples'
import { BreakdownTable } from '../components/BreakdownTable'
import { CardRow } from '../components/Card'
import styles from './Rules.module.css'

export function RuleExample({ example }: { example: RulesExample }) {
  return (
    <figure className={styles.example} id={`example-${example.id}`}>
      <figcaption>
        <strong>{example.title}</strong>
        {example.kind !== 'scoring' && <Verdict legal={example.expected === null} />}
      </figcaption>
      {example.kind === 'meld' && <MeldBody example={example} />}
      {example.kind === 'pickup' && <PickupBody example={example} />}
      {example.kind === 'scoring' && <ScoringBody example={example} />}
      <p>{example.caption}</p>
    </figure>
  )
}

function Verdict({ legal }: { legal: boolean }) {
  return (
    <span className={legal ? styles.legal : styles.illegal}>{legal ? 'Legal' : 'Not allowed'}</span>
  )
}

function Labeled({ label, cards }: { label: string; cards: CardValue[] }) {
  return (
    <div className={styles.labeled}>
      <span>{label}</span>
      <CardRow cards={cards} />
    </div>
  )
}

function MeldBody({ example }: { example: MeldExample }) {
  const { before, added } = buildMeld(example)
  return (
    <>
      {before.length > 0 && <Labeled label="Your meld" cards={before} />}
      <Labeled label={before.length > 0 ? 'Add' : 'Meld'} cards={added} />
      {example.canasta && <p className={styles.note}>Result: a {example.canasta} canasta.</p>}
    </>
  )
}

function PickupBody({ example }: { example: PickupExample }) {
  const { top, player } = buildPickup(example)
  const frozen = !example.hasPickedUpPile || example.wildInPile
  const reason = !example.hasPickedUpPile
    ? 'you have not picked it up yet this round'
    : example.wildInPile
      ? 'a wild is in the pile'
      : ''
  return (
    <>
      <Labeled label="Top of the pile" cards={[top]} />
      {player.hand.length > 0 && <Labeled label="From your hand" cards={player.hand} />}
      {player.melds.map((m, i) => (
        <Labeled
          key={m.id}
          label={example.target === i ? 'Onto your meld' : 'Your meld'}
          cards={m.cards}
        />
      ))}
      <p className={styles.note}>{frozen ? `Frozen for you: ${reason}.` : 'Not frozen for you.'}</p>
    </>
  )
}

function ScoringBody({ example }: { example: ScoringExample }) {
  const players = buildScoringPlayers(example)
  return (
    <>
      {players.map((p) => (
        <div key={p.id} className={styles.scoringPlayer}>
          <strong>
            {p.name}
            {example.wentOut === p.name ? ' (went out)' : ''}
          </strong>
          {p.melds.map((m) => (
            <Labeled key={m.id} label="Meld" cards={m.cards} />
          ))}
          {p.red3s.length > 0 && <Labeled label="Red 3s" cards={p.red3s} />}
          {p.hand.length > 0 && <Labeled label="Left in hand" cards={p.hand} />}
        </div>
      ))}
      <BreakdownTable
        names={players.map((p) => p.name)}
        breakdowns={players.map((p) => example.expected[p.name])}
      />
    </>
  )
}
```

`Rules.module.css` holds the whole rules layout, used by this task's examples and Task 10's page. Write it in full now:

`apps/web/src/rules/Rules.module.css`:
```css
.page {
  display: grid;
  grid-template-columns: 15rem minmax(0, 46rem);
  grid-template-areas: 'header header' 'toc content';
  gap: 0 2.5rem;
  justify-content: center;
  padding: 1rem;
}

.header {
  grid-area: header;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.toc {
  grid-area: toc;
  position: sticky;
  top: 1rem;
  align-self: start;
}

.content {
  grid-area: content;
  font-family: var(--serif);
  font-size: 1.1rem;
}

.section {
  scroll-margin-top: 1rem;
}

.section h2 a {
  color: inherit;
  text-decoration: none;
}

.house {
  border-left: 4px solid var(--gold);
  background: #fdf3d8;
  padding: 0.5rem 0.75rem;
  margin: 0.75rem 0;
}

.quick dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  border: 2px solid var(--felt);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
}

.quick dt {
  font-weight: 700;
}

.quick dd {
  margin: 0;
}

.table {
  border-collapse: collapse;
  width: 100%;
  font-family: var(--font);
  font-size: 0.95rem;
}

.table th,
.table td {
  border-bottom: 1px solid #ddd6c8;
  padding: 0.3rem 0.5rem;
  text-align: left;
}

.examples {
  display: grid;
  gap: 1rem;
}

.example {
  margin: 0;
  border: 1px solid #ddd6c8;
  border-radius: var(--radius);
  padding: 0.75rem;
  background: white;
  font-family: var(--font);
  font-size: 0.95rem;
  break-inside: avoid;
}

.example figcaption {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.labeled {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.4rem 0;
}

.labeled > span:first-child {
  min-width: 8rem;
  color: var(--muted);
}

.legal {
  color: var(--ok);
  font-weight: 700;
}

.illegal {
  color: var(--bad);
  font-weight: 700;
}

.note {
  color: var(--muted);
  margin: 0.25rem 0;
}

.scoringPlayer {
  margin-bottom: 0.5rem;
}

.print {
  margin-left: auto;
}

@media (max-width: 800px) {
  .page {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'header' 'toc' 'content';
  }

  .toc {
    position: static;
  }

  .labeled {
    flex-wrap: wrap;
  }
}

@media print {
  .page {
    display: block;
    padding: 0;
  }

  .toc,
  .print {
    display: none;
  }

  .content {
    font-size: 11pt;
  }

  .section {
    break-inside: avoid-page;
  }

  .house {
    background: none;
  }
}
```

- [ ] **Step 5: Run all checks**

Run: `npm run format && npm test && npm run typecheck && npm run lint && npm run format:check`
Expected: 223 engine tests (206 + 17) and 56 web tests (39 + 3 tables + 14 examples) pass.

- [ ] **Step 6: Commit**

```bash
git add packages/engine apps/web
git commit -m "Add engine-checked rules examples and rules tables"
```

---

### Task 10: Rules page and in-game drawer

**Files:**
- Create: `apps/web/src/rules/RulesContent.tsx`, `apps/web/src/rules/drawer.ts`, `apps/web/src/pages/RulesPage.tsx`, `apps/web/src/components/RulesDrawer.tsx`, `apps/web/src/components/RulesDrawer.module.css`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/components/WhyLink.tsx`, `apps/web/src/pages/GamePage.tsx`

**Interfaces:**
- Consumes: Task 9's modules and the engine constants.
- Produces:
  - `RulesContent()`: the quick-reference card, then Overview → Setup → Card values → Your turn → Melds and canastas → Initial meld → Picking up the pile → Going out → Scoring → Winning → "Our house rules vs. standard Canasta". Every section has an `id` equal to its `PageSection`, so `/rules#pickup` works. Every [clarified] item from spec Section 3 is a gold "House rule" callout where it applies. Examples appear in the section named by their `section`.
  - `QuickReference()`: goal, meld, canasta, Red 3, going out and initial-meld minimums, all from constants.
  - `RulesDrawerContext`, `useOpenRules()`: `(section: PageSection) => void`, provided by `GamePage`.
  - `RulesPage()`: header with a **Print** button, a table of contents that is sticky beside the text on desktop and a collapsible `<details>` above it below 800 px, and a scroll to the hash on load.
  - `RulesDrawer({ section, onClose })`: a modal `<dialog>` that slides over from the right, full height, `min(40rem, 100vw)` wide; it renders `RulesContent` and scrolls to the requested section.
  - In a game, **Rules** (fixed top-right) opens the drawer at Overview, and a toast's or the staging area's "Why?" opens it at the rule's section instead of leaving the table. Outside a game, "Why?" is a normal link to `/rules#section`.

- [ ] **Step 1: Implement the content**

`apps/web/src/rules/RulesContent.tsx`:
```tsx
import {
  CANASTA_SIZE,
  CONCEALED_HAND_BONUS,
  GOING_OUT_BONUS,
  MAX_PLAYERS,
  MIN_MELD_SIZE,
  MIN_PLAYERS,
  MIXED_CANASTA_BONUS,
  NATURAL_CANASTA_BONUS,
  RED_THREE_BONUS,
  WINNING_SCORE,
  type RuleSection,
} from '@canasta/engine'
import { RULES_EXAMPLES } from '@canasta/engine/examples'
import type { ReactNode } from 'react'
import { RuleExample } from './RuleExample'
import styles from './Rules.module.css'
import { cardValueRows, initialMeldRows, tableSizeRows } from './tables'

const fmt = (n: number) => n.toLocaleString('en-US')

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>
        <a href={`#${id}`}>{title}</a>
      </h2>
      {children}
    </section>
  )
}

/** A [clarified] item from the spec: not on the V3 sheet, or settling an ambiguity in it. */
function House({ children }: { children: ReactNode }) {
  return (
    <aside className={styles.house}>
      <strong>House rule</strong> {children}
    </aside>
  )
}

function Examples({ section }: { section: RuleSection }) {
  const examples = RULES_EXAMPLES.filter((e) => e.section === section)
  if (examples.length === 0) return null
  return (
    <div className={styles.examples}>
      {examples.map((e) => (
        <RuleExample key={e.id} example={e} />
      ))}
    </div>
  )
}

export function QuickReference() {
  return (
    <Section id="quick-reference" title="Quick reference">
      <div className={styles.quick}>
        <dl>
          <dt>Goal</dt>
          <dd>First to {fmt(WINNING_SCORE)} at the end of a round</dd>
          <dt>Meld</dt>
          <dd>{MIN_MELD_SIZE}+ cards of one rank, at least 2 natural, wilds ≤ naturals</dd>
          <dt>Canasta</dt>
          <dd>
            {CANASTA_SIZE}+ cards: natural {NATURAL_CANASTA_BONUS}, mixed {MIXED_CANASTA_BONUS}
          </dd>
          <dt>Red 3</dt>
          <dd>
            +{RED_THREE_BONUS} each if you melded this round, −{RED_THREE_BONUS} if not
          </dd>
          <dt>Going out</dt>
          <dd>
            +{GOING_OUT_BONUS}, plus {CONCEALED_HAND_BONUS} if concealed. Needs a canasta; not on
            your first turn
          </dd>
          <dt>Initial meld</dt>
          <dd>
            {initialMeldRows()
              .map((r) => `${r.score}: ${r.minimum}`)
              .join(' · ')}
          </dd>
        </dl>
      </div>
    </Section>
  )
}

export function RulesContent() {
  return (
    <>
      <QuickReference />

      <Section id="overview" title="Overview">
        <p>
          Cutthroat Canasta is Canasta for {MIN_PLAYERS} to {MAX_PLAYERS} players, each playing for
          themselves. You score by laying down melds of the same rank, and above all by building
          canastas: melds of {CANASTA_SIZE} or more cards. A round ends when someone goes out or the
          stock runs out. The game ends after the round in which someone reaches{' '}
          {fmt(WINNING_SCORE)} points.
        </p>
      </Section>

      <Section id="setup" title="Setup">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Players</th>
              <th scope="col">Decks (with 2 Jokers each)</th>
              <th scope="col">Cards dealt</th>
            </tr>
          </thead>
          <tbody>
            {tableSizeRows().map((r) => (
              <tr key={r.players}>
                <td>{r.players}</td>
                <td>{r.decks}</td>
                <td>{r.hand}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          After the deal, Red 3s are laid face up and replaced from the stock automatically, until
          nobody holds one. One card is turned up to start the discard pile. The dealer moves one
          seat to the left each round, and the player on the dealer's left goes first.
        </p>
        <House>
          If the first upcard is a Red 3 or a wild, it is buried in the stock and another card is
          turned up. A wild buried this way freezes the pile for everyone, as if it were in the
          pile.
        </House>
        <House>The sheet's Perfect Cut Bonus is not used online.</House>
      </Section>

      <Section id="card-values" title="Card values">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Card</th>
              <th scope="col">Role</th>
              <th scope="col">Points</th>
            </tr>
          </thead>
          <tbody>
            {cardValueRows().map((r) => (
              <tr key={r.cards}>
                <td>{r.cards}</td>
                <td>{r.role}</td>
                <td>{r.points}</td>
              </tr>
            ))}
            <tr>
              <td>Red 3</td>
              <td>Bonus card, laid face up</td>
              <td>{RED_THREE_BONUS}</td>
            </tr>
          </tbody>
        </table>
        <House>
          Red 3s score a flat {RED_THREE_BONUS} each. There is no bonus for holding all four.
        </House>
      </Section>

      <Section id="turn" title="Your turn">
        <ol>
          <li>
            <strong>Draw</strong> one card from the stock, or pick up the discard pile (see below).
            A Red 3 you draw is laid face up and replaced automatically.
          </li>
          <li>
            <strong>Meld</strong> as many cards as you like.
          </li>
          <li>
            <strong>Discard</strong> one card to end your turn. Discarding your last card is going
            out.
          </li>
        </ol>
        <House>
          If the stock is empty when you must draw, you may pick up the pile if that is legal for
          you. Otherwise, drawing ends the round at once: nobody gets a going-out bonus, and
          everyone scores what they have. The round also ends this way if the only cards left to
          draw are Red 3s.
        </House>
      </Section>

      <Section id="melds" title="Melds and canastas">
        <ul>
          <li>
            A meld is {MIN_MELD_SIZE} or more cards of one natural rank (4 through Ace), with at
            least 2 natural cards.
          </li>
          <li>3s can never be melded, Black or Red, not even when going out.</li>
          <li>
            You can add cards from your hand to any of your own melds, including a finished canasta,
            as long as the meld stays legal. You can never add to another player's melds.
          </li>
          <li>
            A <strong>canasta</strong> is a meld of {CANASTA_SIZE} or more cards. It is{' '}
            <em>natural</em> with no wilds ({NATURAL_CANASTA_BONUS} bonus) and <em>mixed</em> with
            any wild ({MIXED_CANASTA_BONUS} bonus).
          </li>
          <li>
            Everything you meld in one play is checked together, so several melds can add up to your
            initial meld.
          </li>
        </ul>
        <House>
          Jokers and 2s together may not outnumber the natural cards in a meld: wilds ≤ naturals.
        </House>
        <House>
          You may have more than one meld of the same rank. A new one needs at least {MIN_MELD_SIZE}{' '}
          cards that make a legal meld on their own.
        </House>
        <House>Adding a wild to a natural canasta makes it mixed.</House>
        <Examples section="melds" />
      </Section>

      <Section id="initial-meld" title="Initial meld">
        <p>
          Your first meld play in each round must be worth a minimum number of points, based on your
          total score at the start of the round:
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Your score</th>
              <th scope="col">Minimum</th>
            </tr>
          </thead>
          <tbody>
            {initialMeldRows().map((r) => (
              <tr key={r.score}>
                <td>{r.score}</td>
                <td>{r.minimum}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <House>
          Only card values count toward the minimum: Red 3s and canasta bonuses do not. If you make
          your initial meld while picking up the pile, the top discard counts, but the rest of the
          pile does not.
        </House>
      </Section>

      <Section id="pickup" title="Picking up the pile">
        <ul>
          <li>
            The pile is <strong>frozen for you</strong> until you have picked it up once this round.
            It is also frozen for everyone while a wild is anywhere in it.
          </li>
          <li>Nobody can pick up the pile while a Black 3 or a wild is on top.</li>
          <li>
            To pick up the pile, you meld the top card at once, in the same play. Then the rest of
            the pile goes into your hand.
          </li>
          <li>
            <strong>Frozen for you:</strong> the top card must start a new meld with a natural pair
            of its rank from your hand.
          </li>
          <li>
            <strong>Not frozen for you:</strong> the top card can start a new meld with a natural
            pair, or with one natural and one wild from your hand. Or it can join one of your melds
            of that rank that is not yet a canasta.
          </li>
          <li>
            The same play can include other melds and additions from your hand. If it is your
            initial meld, the whole play must reach the minimum.
          </li>
          <li>
            Once you pick up the pile, it stays unfrozen for you for the rest of the round, unless a
            wild is in it.
          </li>
        </ul>
        <House>
          A finished canasta can never take the top card. With a canasta of 5s and no unfinished
          meld of 5s, you can only take a discarded 5 by starting a new meld of 5s from your hand.
        </House>
        <Examples section="pickup" />
      </Section>

      <Section id="going-out" title="Going out">
        <ul>
          <li>
            To go out you need at least one canasta after your play. Then either meld every card
            left in your hand, or discard your last card.
          </li>
          <li>You can't go out on your own first turn of a round.</li>
          <li>Going out ends the round immediately.</li>
        </ul>
        <House>
          When you are not allowed to go out, a play must leave you at least 2 cards: one to discard
          and one to keep.
        </House>
        <Examples section="going-out" />
      </Section>

      <Section id="scoring" title="Scoring">
        <p>At the end of each round, each player scores:</p>
        <ul>
          <li>+ the value of every card in their melds</li>
          <li>
            + {NATURAL_CANASTA_BONUS} for each natural canasta and {MIXED_CANASTA_BONUS} for each
            mixed canasta
          </li>
          <li>
            + {RED_THREE_BONUS} for each Red 3 if they melded this round, or − {RED_THREE_BONUS}{' '}
            each if they did not
          </li>
          <li>− the value of every card left in their hand</li>
          <li>
            For the player who went out: + {GOING_OUT_BONUS}, and + {CONCEALED_HAND_BONUS} more for
            a concealed hand: they had not melded at all before the turn they went out on
          </li>
        </ul>
        <p>If the stock ran out, nobody gets the going-out or concealed bonus.</p>
        <House>The concealed bonus still counts if you picked up the pile on that turn.</House>
        <Examples section="scoring" />
      </Section>

      <Section id="winning" title="Winning">
        <p>
          The game ends after a round in which at least one player's total reaches{' '}
          {fmt(WINNING_SCORE)}. The highest total wins.
        </p>
        <House>An exact tie for the highest total is a shared win.</House>
      </Section>

      <Section id="house-rules" title="Our house rules vs. standard Canasta">
        <p>Standard here means the usual four-player partnership game.</p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Here</th>
              <th scope="col">Standard Canasta</th>
            </tr>
          </thead>
          <tbody>
            {HOUSE_DIFFERENCES.map(([here, standard]) => (
              <tr key={here}>
                <td>{here}</td>
                <td>{standard}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  )
}

const HOUSE_DIFFERENCES: [string, string][] = [
  ['Everyone plays for themselves', 'Two partnerships share melds and scores'],
  ['Wilds may not outnumber naturals in a meld', 'At most 3 wilds in a meld'],
  ['3s can never be melded', 'Black 3s can be melded when going out'],
  [`Red 3s are a flat ${RED_THREE_BONUS} each`, 'All four Red 3s score double'],
  [
    'The pile is frozen for you until your first pickup of the round',
    'The pile is frozen for a side until it has made its initial meld',
  ],
  ['You may have several melds of one rank', 'One meld per rank'],
  ['A finished canasta cannot take the top discard', 'The top discard can join a canasta'],
  ["You can't go out on your first turn", 'You may go out on any turn'],
  [
    `Going out concealed earns ${GOING_OUT_BONUS} + ${CONCEALED_HAND_BONUS}`,
    'Going out concealed earns 200 instead of 100',
  ],
  [
    'An empty stock ends the round when a player must draw',
    'Play continues while players can take the discard',
  ],
]
```

`apps/web/src/rules/drawer.ts`:
```ts
import { createContext, useContext } from 'react'
import type { PageSection } from './sections'

/** Inside a game, "Why?" links open the rules drawer instead of leaving the table. */
export const RulesDrawerContext = createContext<((section: PageSection) => void) | null>(null)

export const useOpenRules = () => useContext(RulesDrawerContext)
```

`apps/web/src/pages/RulesPage.tsx`:
```tsx
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import styles from '../rules/Rules.module.css'
import { RulesContent } from '../rules/RulesContent'
import { PAGE_SECTIONS } from '../rules/sections'

export function RulesPage() {
  const { hash } = useLocation()

  useEffect(() => {
    // The browser can't jump to the anchor on load: the page renders after it looks.
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.()
  }, [hash])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/">Cutthroat Canasta</Link>
        <h1>Rules</h1>
        <button type="button" className={styles.print} onClick={() => window.print()}>
          Print
        </button>
      </header>
      <nav className={styles.toc} aria-label="Contents">
        <details open>
          <summary>Contents</summary>
          <ol>
            {PAGE_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </details>
      </nav>
      <main className={styles.content}>
        <RulesContent />
      </main>
    </div>
  )
}
```

`apps/web/src/components/RulesDrawer.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { RulesContent } from '../rules/RulesContent'
import type { PageSection } from '../rules/sections'
import styles from './RulesDrawer.module.css'

export interface RulesDrawerProps {
  /** The section to show, or null when closed. */
  section: PageSection | null
  onClose: () => void
}

/** The rules page in a slide-over panel, so a player can check a rule without leaving the table. */
export function RulesDrawer({ section, onClose }: RulesDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (section === null) {
      if (dialog.open) dialog.close()
      return
    }
    if (!dialog.open) dialog.showModal?.()
    dialog.querySelector(`#${section}`)?.scrollIntoView?.({ block: 'start' })
  }, [section])

  return (
    <dialog ref={dialogRef} className={styles.drawer} onClose={onClose} aria-label="Rules">
      <button type="button" className={styles.close} onClick={onClose}>
        Close
      </button>
      {section !== null && <RulesContent />}
    </dialog>
  )
}
```

`apps/web/src/components/RulesDrawer.module.css`:
```css
.drawer {
  margin: 0 0 0 auto;
  height: 100dvh;
  max-height: none;
  width: min(40rem, 100vw);
  border: none;
  padding: 1rem 1.25rem;
  overflow-y: auto;
  background: var(--paper);
}

.drawer::backdrop {
  background: rgb(0 0 0 / 0.4);
}

.close {
  position: sticky;
  top: 0;
  float: right;
}
```

Replace `apps/web/src/components/WhyLink.tsx`:

`apps/web/src/components/WhyLink.tsx`:
```tsx
import type { RuleSection } from '@canasta/engine'
import { Link } from 'react-router'
import { useOpenRules } from '../rules/drawer'

/** "Why?" for a rule error. In a game it opens the rules drawer; elsewhere it links to /rules. */
export function WhyLink({ section }: { section: RuleSection }) {
  const openRules = useOpenRules()
  if (!openRules) return <Link to={`/rules#${section}`}>Why?</Link>
  return (
    <a
      href={`/rules#${section}`}
      onClick={(event) => {
        event.preventDefault()
        openRules(section)
      }}
    >
      Why?
    </a>
  )
}
```

In `App.tsx`, add `import { RulesPage } from './pages/RulesPage'` and `<Route path="/rules" element={<RulesPage />} />` after the game route.

Replace `apps/web/src/pages/GamePage.tsx` with its final form (the provider, the **Rules** button and the drawer are the only changes):

`apps/web/src/pages/GamePage.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { normalizeCode } from '../api'
import type { ConnectionStatus } from '../connection'
import { RulesDrawer } from '../components/RulesDrawer'
import { Toasts } from '../components/Toasts'
import { RulesDrawerContext } from '../rules/drawer'
import type { PageSection } from '../rules/sections'
import { loadName, loadToken, tokenFromHash } from '../storage'
import { useGame } from '../useGame'
import { Lobby } from './Lobby'
import styles from './Pages.module.css'
import { Table } from './Table'

/** Navigation state the home page passes: join with this name right away. */
export interface GamePageState {
  join?: string
}

/** After this many failed connects in a row, warn that the code may be wrong. */
const UNREACHABLE_AFTER = 3

export function GamePage() {
  const params = useParams()
  const code = normalizeCode(params.code ?? '')
  if (!code) {
    return (
      <main className={styles.home}>
        <p>That isn't a valid game code.</p>
        <Link to="/">Back to the start</Link>
      </main>
    )
  }
  return <Game key={code} code={code} />
}

function Game({ code }: { code: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  // Read once: the hash is removed below, and the name only applies to the first join.
  const [linkToken] = useState(() => tokenFromHash(location.hash))
  const [autoJoinName] = useState(() => (location.state as GamePageState | null)?.join ?? null)
  // With a token or a name the page joins by itself, so it shows "Joining…", not the form.
  const [joinsByItself] = useState(() => Boolean(linkToken || autoJoinName || loadToken(code)))
  const { state, join, send, dismissToast } = useGame(code, { linkToken, autoJoinName })
  const [drawer, setDrawer] = useState<PageSection | null>(null)

  useEffect(() => {
    // Keep the token out of the address bar, history and anything the player shares.
    if (location.hash) navigate({ pathname: location.pathname, hash: '' }, { replace: true })
  }, [location.hash, location.pathname, navigate])

  useEffect(() => {
    if (!state.removed) return
    const notice =
      state.removed === 'kicked' ? 'The host removed you from the game.' : 'You left the game.'
    navigate('/', { replace: true, state: { notice } })
  }, [state.removed, navigate])

  const view = state.view
  let body
  if (!state.playerId && (state.joining || (joinsByItself && !state.joinError))) {
    body = <p className={styles.banner}>Joining…</p>
  } else if (!state.playerId || !view) {
    body = (
      <JoinForm
        code={code}
        error={state.joinError}
        waiting={state.connection !== 'open'}
        onJoin={join}
      />
    )
  } else if (view.status === 'lobby') {
    body = (
      <Lobby
        code={code}
        view={view}
        playerId={state.playerId}
        hostId={state.hostId}
        connected={state.connected}
        send={send}
      />
    )
  } else {
    body = <Table key={view.round?.number} code={code} view={view} state={state} send={send} />
  }

  return (
    <RulesDrawerContext.Provider value={setDrawer}>
      <ConnectionBanner connection={state.connection} failures={state.failures} code={code} />
      {body}
      <button type="button" className={styles.rulesButton} onClick={() => setDrawer('overview')}>
        Rules
      </button>
      <Toasts toasts={state.toasts} onDismiss={dismissToast} />
      <RulesDrawer section={drawer} onClose={() => setDrawer(null)} />
    </RulesDrawerContext.Provider>
  )
}

function ConnectionBanner({
  connection,
  failures,
  code,
}: {
  connection: ConnectionStatus
  failures: number
  code: string
}) {
  if (connection === 'open') return null
  return (
    <p className={styles.banner} role="status">
      {failures >= UNREACHABLE_AFTER
        ? `Can't reach game ${code}. Check the code, or wait while we keep trying.`
        : connection === 'connecting'
          ? 'Connecting…'
          : 'Reconnecting…'}
    </p>
  )
}

function JoinForm({
  code,
  error,
  waiting,
  onJoin,
}: {
  code: string
  error: string | null
  waiting: boolean
  onJoin: (name: string) => void
}) {
  const [name, setName] = useState(loadName)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) onJoin(name.trim())
  }
  return (
    <main className={styles.home}>
      <h1>Join game {code}</h1>
      <form className={styles.join} onSubmit={submit}>
        <label>
          Your name
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={waiting || !name.trim()}>
          Join
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
    </main>
  )
}
```

- [ ] **Step 2: Run all checks**

Run: `npm run format && npm test && npm run typecheck && npm run lint && npm run format:check && npm run build -w @canasta/web`
Expected: 223 engine, 90 server and 56 web tests pass, and everything else is clean. The staging-area test still passes: outside the drawer context, "Why?" is a plain link to `/rules#melds`.

- [ ] **Step 3: Check the prose against spec Section 3**

Read `RulesContent.tsx` beside spec Section 3, item by item, and fix any sentence that disagrees with the spec (never the reverse; a rule change goes into the spec first). In particular confirm:
- Black 3s: never meldable, and a Black 3 on top blocks the pile for **everyone**, not only the next player.
- The personal freeze: frozen for you until **your own** first pickup this round, and frozen for everyone while a wild is in the pile.
- The concealed bonus: +200 **on top of** the 100 going-out bonus, when you had not melded before the turn you went out on, even with a pickup that turn.
- Red 3s: +100 each if you melded this round, −100 each if not; no four-of-a-kind bonus.
- Empty stock: "draw" ends the round with no going-out bonus; a draw that finds only Red 3s does the same.
- A player who can't go out must keep at least 2 cards after melding.

Then read the "Standard Canasta" column once more. It is general knowledge, not from the spec; if anything in it is doubtful, remove that row rather than guess.

- [ ] **Step 4: Check the page by hand**

With `npm run dev:web` running:
- `/rules` on desktop: the contents list stays in view while scrolling; `/rules#pickup` opens at the pickup section.
- At 375 px: one column, the contents collapse into a `<details>`, tables and examples don't overflow sideways.
- Print preview: no contents list or print button, examples don't split across pages, and the gold callout backgrounds are gone.
- In a game: **Rules** opens the drawer; a rule-error toast's "Why?" opens the drawer at that section; Escape or **Close** returns to the table without reconnecting.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "Add the rules page and the in-game rules drawer"
```

---

### Task 11: Documentation

**Files:**
- Modify: `README.md`, `docs/handoffs/2026-09-27-canasta-rules-engine.md`

**Interfaces:**
- Consumes: the finished client.
- Produces: a README that documents the client and the heartbeat, and a handoff that records Plan 3.

- [ ] **Step 1: Update the README**

- Project layout: change `apps/web` from `(planned)` to `(implemented)`.
- Development block: add `npm run dev:web          # Run the web client (Vite, http://localhost:5173; proxies /api to dev:server)` below `dev:server`, keeping the comment alignment, and a sentence that both dev commands run together in two terminals.
- Server section, client messages table: add a row for the heartbeat, `'{"type":"ping"}'` (the exact text) | "Heartbeat, every 20 s. The server answers without waking the room". Server messages table: add `{ "type": "pong" }` | "The heartbeat reply". Add one sentence after the tables: a socket that sends nothing for 70 s stops counting as connected and is closed (code 4000); the client reconnects with its token.
- Add a `## Web client` section after Server: the three routes; the token in localStorage keyed by game code; rejoin links (`/g/CODE#token=…`); the staging area (select, **New meld**, click a meld to add to it, **Meld** / **Pick up pile** / **Discard** / **Clear**, the live preview from `legalityPreview`); and the rules page (tables from engine constants, examples checked by the engine test, the drawer in a game, print-friendly).
- Status: the engine, server and web client are implemented; deployment is not set up yet.

Run `npm run format` (the README is Prettier-formatted, including the tables).

- [ ] **Step 2: Update the handoff**

Add a "Plan 3: web client" status table (task, status, commits), the new test counts, and these decisions: the root Vitest 5 for the web app, jsdom 29 (Node 24.10), the heartbeat constants and the stale-socket rule, examples in `@canasta/engine/examples`. Close the "Half-open sockets" open question, and move this plan's Open Questions there.

- [ ] **Step 3: Run all checks**

Run: `npm run format && npm test && npm run typecheck && npm run lint && npm run format:check`
Expected: everything passes.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/handoffs
git commit -m "Document the web client and heartbeat"
```

---

## Deferred

- **Deployment.** Serving the built client from the Worker with Workers static assets, and `wrangler deploy` with the user's Cloudflare account.
- **Feed payload.** Every broadcast resends the whole round feed (handoff open question). The client only reads it, so sending deltas later changes `gameState.ts` and nothing else.
- **No host after a mid-game token loss** (handoff open question): unchanged by this plan.

## Open Questions

All three were decided on 2026-09-28; see Amendments.

1. **Presence refresh for a stale socket.** With the minimal server change, a dead phone stops counting as connected, but other players only see its dot turn grey at the next message or close in the room (any turn action). A Durable Object alarm every ~30 s while sockets are open would refresh presence on its own, at the cost of waking the room. Keep it minimal (recommended), or add the alarm?
2. **Heartbeat timing.** Ping every 20 s, and a socket is stale after 70 s. So a host waits up to about 70 s before they can reissue a dead phone's seat. A shorter limit risks marking background tabs as disconnected. Are these numbers acceptable?
3. **Unknown game codes.** No route says whether a code exists, so `/g/WRONG1` shows "Can't reach game WRONG1…" after three failed connects, while it keeps retrying. A tiny `GET /api/games/:code` (200 or 404) would give a clear "No such game" at once. Add it, or keep the retry message?
