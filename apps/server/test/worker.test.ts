import { SELF, env, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import type { ServerMessage } from '../src/protocol'
import type { RoomState } from '../src/room'

type Joined = Extract<ServerMessage, { type: 'joined' }>
type StateMessage = Extract<ServerMessage, { type: 'state' }>

interface Client {
  send(message: unknown): void
  sendRaw(data: string): void
  next(): Promise<ServerMessage>
  expectQuiet(ms?: number): Promise<void>
  close(): void
}

async function createGame(): Promise<string> {
  const response = await SELF.fetch('http://example.com/api/games', { method: 'POST' })
  expect(response.status).toBe(201)
  const { code } = (await response.json()) as { code: string }
  return code
}

async function connect(code: string): Promise<Client> {
  const response = await SELF.fetch(`http://example.com/api/games/${code}/ws`, {
    headers: { Upgrade: 'websocket' },
  })
  const ws = response.webSocket
  if (!ws) throw new Error(`Expected a WebSocket, got status ${response.status}`)
  ws.accept()

  const inbox: ServerMessage[] = []
  let wake: (() => void) | null = null
  ws.addEventListener('message', (event) => {
    inbox.push(JSON.parse(event.data as string) as ServerMessage)
    wake?.()
  })
  const waitForMessage = (ms: number) =>
    new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer)
        wake = null
        resolve()
      }
      const timer = setTimeout(done, ms)
      wake = done
    })

  return {
    send: (message) => ws.send(JSON.stringify(message)),
    sendRaw: (data) => ws.send(data),
    async next() {
      if (inbox.length === 0) await waitForMessage(2000)
      const message = inbox.shift()
      if (!message) throw new Error('Timed out waiting for a message')
      return message
    },
    async expectQuiet(ms = 200) {
      if (inbox.length === 0) await waitForMessage(ms)
      expect(inbox).toEqual([])
    },
    close: () => ws.close(1000, 'done'),
  }
}

async function join(client: Client, name: string, token?: string): Promise<Joined> {
  client.send(token ? { type: 'join', name, token } : { type: 'join', name })
  const message = await client.next()
  expect(message.type).toBe('joined')
  return message as Joined
}

async function nextState(client: Client): Promise<StateMessage> {
  const message = await client.next()
  expect(message.type).toBe('state')
  return message as StateMessage
}

/** Creates a game with Ann (host) and Bob joined, drains the lobby broadcasts, and starts it. */
async function startedGame() {
  const code = await createGame()
  const ann = await connect(code)
  const annJoined = await join(ann, 'Ann')
  await nextState(ann)
  const bob = await connect(code)
  const bobJoined = await join(bob, 'Bob')
  await nextState(bob)
  await nextState(ann)
  ann.send({ type: 'start' })
  return {
    code,
    ann,
    bob,
    annJoined,
    bobJoined,
    annState: await nextState(ann),
    bobState: await nextState(bob),
  }
}

describe('routes', () => {
  it('creates a game with a 6-character code', async () => {
    expect(await createGame()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/)
  })

  it('returns 404 for unknown or malformed codes', async () => {
    const unknown = await SELF.fetch('http://example.com/api/games/QQQQQQ/ws', {
      headers: { Upgrade: 'websocket' },
    })
    expect(unknown.status).toBe(404)
    const malformed = await SELF.fetch('http://example.com/api/games/abc/ws', {
      headers: { Upgrade: 'websocket' },
    })
    expect(malformed.status).toBe(404)
  })

  it('requires a WebSocket upgrade for a real game', async () => {
    const code = await createGame()
    const response = await SELF.fetch(`http://example.com/api/games/${code}/ws`)
    expect(response.status).toBe(426)
  })

  it('accepts lowercase codes', async () => {
    const code = await createGame()
    const client = await connect(code.toLowerCase())
    expect((await join(client, 'Ann')).code).toBe(code)
  })
})

describe('game room', () => {
  it('plays from lobby to start with per-player views', async () => {
    const code = await createGame()
    const watcher = await connect(code)
    const ann = await connect(code)
    const annJoined = await join(ann, 'Ann')
    expect(await nextState(ann)).toMatchObject({ hostId: annJoined.playerId })
    await watcher.expectQuiet()

    const bob = await connect(code)
    await join(bob, 'Bob')
    await nextState(bob)
    await nextState(ann)

    ann.send({ type: 'start' })
    const annState = await nextState(ann)
    const bobState = await nextState(bob)
    expect(annState.view.status).toBe('playing')
    expect(annState.view.you?.id).toBe(annJoined.playerId)
    expect(annState.view.you?.hand).toHaveLength(15)
    expect(annState.view.players[1]).not.toHaveProperty('hand')
    expect(annState.view.players[1].handCount).toBe(15)
    expect(bobState.view.you?.name).toBe('Bob')
    await watcher.expectQuiet()
  })

  it('sends rule errors only to the player who caused them', async () => {
    const { ann, bob } = await startedGame()
    // Ann dealt, so Bob goes first.
    ann.send({ type: 'action', action: { type: 'drawStock' } })
    expect(await ann.next()).toMatchObject({ type: 'error', code: 'NOT_YOUR_TURN' })
    await bob.expectQuiet()

    bob.send({ type: 'action', action: { type: 'drawStock' } })
    expect((await nextState(bob)).view.round?.phase).toBe('play')
    expect((await nextState(ann)).view.round?.phase).toBe('play')
  })

  it('rejects malformed messages without dropping the connection', async () => {
    const { ann, bob } = await startedGame()
    ann.sendRaw('not json')
    expect(await ann.next()).toMatchObject({ type: 'error', code: 'BAD_MESSAGE' })
    ann.send({ type: 'action', action: { type: 'bogus' } })
    expect(await ann.next()).toMatchObject({ type: 'error', code: 'BAD_MESSAGE' })
    bob.send({ type: 'start' })
    expect(await bob.next()).toMatchObject({ type: 'error', code: 'NOT_HOST' })
  })

  it('reattaches a returning player by token', async () => {
    const { code, ann, annJoined } = await startedGame()
    ann.close()
    const again = await connect(code)
    const rejoined = await join(again, 'Ann', annJoined.token)
    expect(rejoined.playerId).toBe(annJoined.playerId)
    const state = await nextState(again)
    expect(state.view.you?.id).toBe(annJoined.playerId)
    expect(state.view.status).toBe('playing')
  })

  it('tracks who is connected', async () => {
    const code = await createGame()
    const ann = await connect(code)
    const annJoined = await join(ann, 'Ann')
    await nextState(ann)
    const bob = await connect(code)
    const bobJoined = await join(bob, 'Bob')
    await nextState(bob)
    expect((await nextState(ann)).connected).toEqual([annJoined.playerId, bobJoined.playerId])

    bob.close()
    expect((await nextState(ann)).connected).toEqual([annJoined.playerId])

    const bobAgain = await connect(code)
    const bobRejoined = await join(bobAgain, 'Bob', bobJoined.token)
    expect(bobRejoined.playerId).toBe(bobJoined.playerId)
    await nextState(bobAgain)
    expect((await nextState(ann)).connected).toEqual([annJoined.playerId, bobJoined.playerId])
  })

  it('persists the room to Durable Object storage', async () => {
    const { code, annJoined } = await startedGame()
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code))
    await runInDurableObject(stub, async (_instance, state) => {
      const room = await state.storage.get<RoomState>('room')
      expect(room?.code).toBe(code)
      expect(room?.hostId).toBe(annJoined.playerId)
      expect(room?.game.status).toBe('playing')
      expect(room?.game.players.map((p) => p.name)).toEqual(['Ann', 'Bob'])
    })
  })
})
