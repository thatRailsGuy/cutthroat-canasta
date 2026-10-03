# Cutthroat Canasta

An online version of the house Cutthroat Canasta rules (V3) for 2–8 players playing individually. Players join a game from separate devices via a shared code and play to 5,000 points. Built as a TypeScript monorepo with a pure rules engine (zero runtime dependencies), a Cloudflare Workers server, and a React + Vite web client.

## House rules at a glance

- **1-card draw:** each turn, draw one card from stock or pick up the discard pile
- **Black 3s are stop cards:** they can never be melded; while a Black 3 (or a wild) is on top of the discard pile, nobody can pick it up
- **Wild ratio:** wilds (Jokers and 2s) cannot outnumber naturals in a meld (`wilds ≤ naturals`)
- **Personal pile freeze:** the discard pile is frozen for you until your first pickup each round. To take a frozen pile you need a natural pair matching the top card
- **One unfinished meld per rank:** a player can start another meld of a rank only once their meld of that rank is a canasta
- **Frozen upcard:** a wild or Red 3 upcard stays in the discard pile and freezes it for everyone
- **Finished canasta cannot take the pile:** a completed 7+ card meld cannot accept the top discard card
- **Initial meld minimums by score:** 15 points (negative score), 50 (0–1,495), 90 (1,500–2,995), 120 (3,000+)
- **No going out first turn:** a player cannot end the round on their first turn of that round
- **Concealed hand bonus:** 200 points on top of the 100 going-out bonus, if you had not melded at all before the turn you go out on (a pickup on that turn still counts)
- **Game to 5,000:** the game ends after a round in which someone reaches 5,000 points; the highest total wins, and an exact tie is shared

See [docs/superpowers/specs/2026-09-27-cutthroat-canasta-design.md](docs/superpowers/specs/2026-09-27-cutthroat-canasta-design.md) for the complete rules.

## Project layout

```text
packages/engine    TypeScript rules engine (implemented)
apps/server        Cloudflare Worker + Durable Object per game (implemented)
apps/web           React + Vite client: lobby, table, rules page (implemented)
docs/              Design spec and implementation plans
```

## Development

Requires Node 24+.

```sh
npm install              # Install dependencies
npm test                 # Run tests across all packages
npm run typecheck        # Type check all packages
npm run lint             # Lint with ESLint
npm run format           # Format with Prettier
npm run format:check     # Check formatting without modifying files
npm run dev:server       # Run the game server locally (wrangler dev, http://localhost:8787)
npm run dev:web          # Run the web client (Vite, http://localhost:5173; proxies /api to dev:server)
npm run deploy           # Build the web client and deploy it with the server to Cloudflare
```

To play locally, run `npm run dev:server` and `npm run dev:web` together in two terminals, then open `http://localhost:5173`.

To play from phones on the same Wi-Fi, start the web client with `--host` instead of `npm run dev:web`, then open the Network address Vite prints (such as `http://192.168.1.20:5173`) on each phone:

```sh
npm run dev -w @canasta/web -- --host
```

See [docs/playtest.md](docs/playtest.md) for the full playtest setup.

## Deployment

The app deploys as one Cloudflare Worker. The Worker runs `/api/*`, and it serves the built web client (`apps/web/dist`, set in [wrangler.jsonc](apps/server/wrangler.jsonc)) for every other path. A path with no file, such as `/g/ABC234`, gets `index.html`, so the client's router takes it. The page and the API share an origin, as they do behind the Vite proxy in development.

You need a Cloudflare account. The free plan includes the SQLite-backed Durable Objects that `GameRoom` uses. Log in once:

```sh
npx -w @canasta/server wrangler login
```

Then deploy:

```sh
npm run deploy
```

This builds the web client, then runs `wrangler deploy`. Wrangler prints the address, such as `https://cutthroat-canasta.<subdomain>.workers.dev`. Add `--dry-run` to the server step (`npm run build -w @canasta/web && npm run deploy -w @canasta/server -- --dry-run`) to check the bundle without uploading it.

## Server

`apps/server` is a Cloudflare Worker. Each game is one `GameRoom` Durable Object, holding the game state and every player's WebSocket.

- `POST /api/games` creates a game and returns `201 { "code": "ABC234" }`.
- `GET /api/games/:code` returns `200 { "code": "ABC234" }` if the game exists, and 404 for an unknown or malformed code. Codes are case-insensitive, and the reply gives the normalized code.
- `GET /api/games/:code/ws` opens the game's WebSocket.

Messages are JSON. The client sends:

| Message                                            | Meaning                                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `{ "type": "join", "name": "Ann", "token"?: "…" }` | Take a seat (lobby only), or reattach with a saved token. An unknown token gets `UNKNOWN_TOKEN` |
| `{ "type": "start" }`                              | Host only: deal the first round                                                                 |
| `{ "type": "action", "action": { … } }`            | A turn action: `drawStock`, `pickUpPile`, `meld` or `discard`                                   |
| `{ "type": "nextRound" }`                          | Any seated player: deal the next round                                                          |
| `{ "type": "leave" }`                              | Give up your seat (lobby only)                                                                  |
| `{ "type": "kick", "playerId": "…" }`              | Host only: remove a player (lobby only)                                                         |
| `{ "type": "reissue", "playerId": "…" }`           | Host only: new token for a player who isn't connected                                           |
| `'{"type":"ping"}'` (this exact text)              | Heartbeat. The server answers without waking the room                                           |

The server sends:

| Message                                              | Meaning                                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `{ "type": "joined", "code", "playerId", "token" }`  | Your seat. Save the token to reconnect                                                                |
| `{ "type": "state", "view", "hostId", "connected" }` | Your view after any change, with the round's public feed. Other hands are counts until the round ends |
| `{ "type": "error", "code", "message" }`             | Your last message was rejected. Only you receive it                                                   |
| `{ "type": "removed", "reason" }`                    | Your seat is gone (`left` or `kicked`). The connection is unjoined                                    |
| `{ "type": "reissued", "playerId", "token" }`        | Host only: share this token as a rejoin link. Old tokens stop working                                 |
| `{ "type": "seatReissued", "playerId" }`             | Everyone: the host issued a rejoin link for this seat                                                 |
| `{ "type": "pong" }`                                 | The heartbeat reply                                                                                   |

Error codes are the engine's rule errors plus the protocol errors `BAD_MESSAGE`, `NOT_JOINED`, `NOT_HOST`, `ALREADY_JOINED`, `NO_SUCH_PLAYER`, `PLAYER_CONNECTED` and `UNKNOWN_TOKEN`. `UNKNOWN_TOKEN` answers a `join` whose token belongs to no seat (it was left, kicked or reissued); the client then forgets the token and asks for a name.

**Heartbeat.** The client pings every 20 s. If a ping gets no reply (a pong or any other message) within 10 s, the client drops the socket and reconnects with its token. When the page becomes visible again, it pings at once. On the server, a socket that has sent nothing (no message and no ping) for 70 s is stale. Pings are answered by the runtime without waking the room, so the room checks for stale sockets only when a message, close or error arrives. It then unbinds each stale socket, closes it with code 4000 and tells the table, so the player stops counting as connected. Until something wakes the room, a dead phone can still show as connected. So the host sees a small **Seat stuck? Make rejoin link** button on every connected opponent. The reissue request itself wakes the room: a silent seat is dropped and reissued, and a live player's seat is refused with `PLAYER_CONNECTED` ("Bob is still connected…").

Message types are exported from `@canasta/server/protocol`.

## Web client

`apps/web` is a React app built with Vite. It imports the engine for the legality preview and the rules page, and only types from `@canasta/server/protocol`, so no server code ships in the bundle.

- **Routes:** `/` (create a game, or join one by code), `/g/:code` (the join form, the lobby and the table), and `/rules`.
- **Seats:** the seat token is saved in localStorage under `canasta:token:<CODE>`, so a reload or a reconnect gets the same seat back. A rejoin link from the host is `/g/CODE#token=…`. The page saves the token and removes it from the address bar at once.
- **Staging area:** select cards from your hand (and the top discard, during your draw phase). **New meld** stages the selection as a new meld, and clicking one of your melds stages it as an addition. **Meld**, **Pick up pile** and **Discard** send exactly what the live preview checked with the engine's `legalityPreview`. An illegal play shows the engine's message with a **Why?** link, and **Clear** empties the staging.
- **Rules page:** its tables come from the engine constants, and every worked example is checked by an engine test (`@canasta/engine/examples`). In a game, **Rules** and every **Why?** open the rules in a drawer without leaving the table. The page prints cleanly.

## Status

The rules engine (`packages/engine`), the server (`apps/server`) and the web client (`apps/web`) are implemented. `npm run deploy` deploys them to Cloudflare (see [Deployment](#deployment)). The engine is checked by a random-game simulation test that plays full games under a seeded bot and asserts invariants (card conservation, hidden-information leakage, and score-breakdown consistency) hold throughout.
