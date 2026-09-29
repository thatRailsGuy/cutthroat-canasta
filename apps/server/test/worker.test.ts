import { SELF, env, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { HEARTBEAT_PING, STALE_CLOSE_CODE, type ServerMessage } from '../src/protocol'
import type { RoomState } from '../src/room'

type Joined = Extract<ServerMessage, { type: 'joined' }>
type StateMessage = Extract<ServerMessage, { type: 'state' }>

interface Client {
  send(message: unknown): void
  sendRaw(data: string): void
  next(): Promise<ServerMessage>
  expectQuiet(ms?: number): Promise<void>
  /** Resolves with the close code once the server closes the socket. */
  closed(): Promise<number>
  close(): void
}

async function createGame(): Promise<string> {
  const response = await SELF.fetch('http://example.com/api/games', { method: 'POST' })
  expect(response.status).toBe(201)
  const { code } = (await response.json()) as { code: string }
  return code
}

/**
 * `halfOpen` makes the client skip the reply to a server's Close frame, as a dead phone would,
 * so the room never gets a close event for it.
 */
async function connect(code: string, { halfOpen = false } = {}): Promise<Client> {
  const response = await SELF.fetch(`http://example.com/api/games/${code}/ws`, {
    headers: { Upgrade: 'websocket' },
  })
  const ws = response.webSocket
  if (!ws) throw new Error(`Expected a WebSocket, got status ${response.status}`)
  ws.accept({ allowHalfOpen: halfOpen })

  const closed = new Promise<number>((resolve) => {
    ws.addEventListener('close', (event) => resolve(event.code))
  })
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
    closed: () => closed,
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

/** Creates a game with Ann (host) and Bob joined, and drains the lobby broadcasts. */
async function lobbyGame({ halfOpenBob = false } = {}) {
  const code = await createGame()
  const ann = await connect(code)
  const annJoined = await join(ann, 'Ann')
  await nextState(ann)
  const bob = await connect(code, { halfOpen: halfOpenBob })
  const bobJoined = await join(bob, 'Bob')
  await nextState(bob)
  await nextState(ann)
  return { code, ann, bob, annJoined, bobJoined }
}

/** Like lobbyGame, then the host starts the game. */
async function startedGame(options: { halfOpenBob?: boolean } = {}) {
  const lobby = await lobbyGame(options)
  lobby.ann.send({ type: 'start' })
  return {
    ...lobby,
    annState: await nextState(lobby.ann),
    bobState: await nextState(lobby.bob),
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

  it('looks up a created game by code', async () => {
    const code = await createGame()
    const response = await SELF.fetch(`http://example.com/api/games/${code}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ code })
  })

  it('looks up a game by a lowercase code', async () => {
    const code = await createGame()
    const response = await SELF.fetch(`http://example.com/api/games/${code.toLowerCase()}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ code })
  })

  it('returns 404 when looking up an unknown code', async () => {
    const response = await SELF.fetch('http://example.com/api/games/QQQQQQ')
    expect(response.status).toBe(404)
    await response.body?.cancel()
  })

  it('returns 404 when looking up a malformed code', async () => {
    const response = await SELF.fetch('http://example.com/api/games/abc')
    expect(response.status).toBe(404)
    await response.body?.cancel()
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

describe('seats', () => {
  it('lets a player leave the lobby and join again', async () => {
    const { ann, bob } = await lobbyGame()
    bob.send({ type: 'leave' })
    expect(await bob.next()).toEqual({ type: 'removed', reason: 'left' })
    expect((await nextState(ann)).view.players.map((p) => p.name)).toEqual(['Ann'])
    await bob.expectQuiet()

    const rejoined = await join(bob, 'Robert')
    expect((await nextState(bob)).view.players.map((p) => p.name)).toEqual(['Ann', 'Robert'])
    expect(rejoined.playerId).toBeTruthy()
  })

  it('lets the host kick a player, whose old token then takes a fresh seat', async () => {
    const { code, ann, bob, bobJoined } = await lobbyGame()
    ann.send({ type: 'kick', playerId: bobJoined.playerId })
    expect(await bob.next()).toEqual({ type: 'removed', reason: 'kicked' })
    expect((await nextState(ann)).view.players).toHaveLength(1)

    bob.send({ type: 'start' })
    expect(await bob.next()).toMatchObject({ type: 'error', code: 'NOT_JOINED' })

    const again = await connect(code)
    const rejoined = await join(again, 'Bob', bobJoined.token)
    expect(rejoined.playerId).not.toBe(bobJoined.playerId)
  })

  it('reissues a disconnected seat, revoking the old token and telling the table', async () => {
    const { code, ann, bob, bobJoined } = await lobbyGame()
    const cat = await connect(code)
    await join(cat, 'Cat')
    await nextState(cat)
    await nextState(ann)
    await nextState(bob)
    const watcher = await connect(code)
    ann.send({ type: 'start' })
    await Promise.all([nextState(ann), nextState(bob), nextState(cat)])

    bob.close()
    await Promise.all([nextState(ann), nextState(cat)])
    ann.send({ type: 'reissue', playerId: bobJoined.playerId })
    const reissued = await ann.next()
    expect(reissued).toMatchObject({ type: 'reissued', playerId: bobJoined.playerId })
    const notice = { type: 'seatReissued', playerId: bobJoined.playerId }
    expect(await ann.next()).toEqual(notice)
    expect(await cat.next()).toEqual(notice)
    await ann.expectQuiet()
    await cat.expectQuiet()
    await watcher.expectQuiet()

    const stale = await connect(code)
    stale.send({ type: 'join', name: 'Bob', token: bobJoined.token })
    expect(await stale.next()).toMatchObject({ type: 'error', code: 'NOT_IN_LOBBY' })

    const fresh = await connect(code)
    const { token } = reissued as Extract<ServerMessage, { type: 'reissued' }>
    expect((await join(fresh, 'Bob', token)).playerId).toBe(bobJoined.playerId)
  })

  it('refuses to reissue a connected seat', async () => {
    const { ann, bobJoined } = await startedGame()
    ann.send({ type: 'reissue', playerId: bobJoined.playerId })
    expect(await ann.next()).toMatchObject({ type: 'error', code: 'PLAYER_CONNECTED' })
  })
})

describe('heartbeat', () => {
  it('answers a ping with a pong and tells nobody else', async () => {
    const { ann, bob } = await startedGame()
    ann.sendRaw(HEARTBEAT_PING)
    expect(await ann.next()).toEqual({ type: 'pong' })
    await ann.expectQuiet()
    await bob.expectQuiet()
  })

  /** Fakes a silent socket by backdating its attachment. */
  async function silence(code: string, playerId: string) {
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code))
    await runInDurableObject(stub, async (_instance, state) => {
      for (const ws of state.getWebSockets()) {
        const attachment = ws.deserializeAttachment() as { playerId: string | null }
        if (attachment.playerId === playerId) {
          ws.serializeAttachment({ ...attachment, seenAt: 0 })
        }
      }
    })
  }

  it('drops a silent socket, so its seat can be reissued', async () => {
    const { code, ann, bob, bobJoined } = await startedGame()
    await silence(code, bobJoined.playerId)

    ann.send({ type: 'reissue', playerId: bobJoined.playerId })
    expect(await ann.next()).toMatchObject({ type: 'reissued', playerId: bobJoined.playerId })
    expect(await ann.next()).toEqual({ type: 'seatReissued', playerId: bobJoined.playerId })
    expect(await bob.closed()).toBe(STALE_CLOSE_CODE)
    await bob.expectQuiet()
  })

  it('tells the table a silent player is gone, even after a rejected action', async () => {
    // Half-open, so the only state Ann can get is the one the dropped seat triggers.
    const { code, ann, annJoined, bob, bobJoined } = await startedGame({ halfOpenBob: true })
    await silence(code, bobJoined.playerId)

    // Ann dealt, so Bob goes first and Ann's draw is rejected.
    ann.send({ type: 'action', action: { type: 'drawStock' } })
    expect(await ann.next()).toMatchObject({ type: 'error', code: 'NOT_YOUR_TURN' })
    expect((await nextState(ann)).connected).toEqual([annJoined.playerId])
    expect(await bob.closed()).toBe(STALE_CLOSE_CODE)
  })
})
