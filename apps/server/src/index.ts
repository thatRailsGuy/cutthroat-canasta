import { normalizeCode, randomCode, randomSeed } from './codes'

export { GameRoom } from './gameRoom'

const MAX_CODE_ATTEMPTS = 5
const WS_ROUTE = /^\/api\/games\/([^/]+)\/ws$/

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/games' && request.method === 'POST') return createGameRoute(env)

    const match = WS_ROUTE.exec(url.pathname)
    if (match && request.method === 'GET') {
      const code = normalizeCode(match[1])
      if (!code) return notFound()
      return roomFor(env, code).fetch(request)
    }
    return notFound()
  },
} satisfies ExportedHandler<Env>

function roomFor(env: Env, code: string) {
  return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code))
}

async function createGameRoute(env: Env): Promise<Response> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomCode()
    if (await roomFor(env, code).init(code, randomSeed())) {
      return Response.json({ code }, { status: 201 })
    }
  }
  return new Response('Could not allocate a game code', { status: 503 })
}

function notFound(): Response {
  return new Response('Not found', { status: 404 })
}
