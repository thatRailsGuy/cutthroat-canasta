# Cutthroat Canasta — Design Spec

Date: 2026-09-27
Status: Draft for review

## 1. Goal

An online version of our house Cutthroat Canasta (House Rule Sheet V3). Friends and family each play on their own device from a shared game link. There are 2–8 players and everyone plays for themselves; there are no partnerships.

Success for v1:

- A group can create a game, share the code, join from separate devices, and play complete games to 5,000 points.
- Every rule on the V3 sheet is enforced by the software, plus the clarifications in Section 3. Players never have to police the rules themselves.
- No player can see another player's hand or the stock order, even by inspecting network traffic.
- A player who reloads or loses connection gets back into their seat.
- A good-looking rules page explains the game, including our clarifications.

## 2. Architecture

A TypeScript monorepo that uses npm workspaces:

```text
packages/engine   pure TypeScript rules engine, zero runtime dependencies, no I/O
apps/server       Cloudflare Worker + one Durable Object (GameRoom) per game
apps/web          React + Vite client (lobby, table, rules page)
```

```text
apps/web (React)              apps/server (Worker)
  ├─ lobby: create/join  ──HTTP──▶  POST /api/games → new GameRoom
  ├─ table view   ◀──WebSocket──▶  GameRoom (Durable Object)
  ├─ rules page                     ├─ holds Game (persisted to DO storage)
  │                                 ├─ applyAction() from engine
  └── imports ──┐                   └─ sends viewFor(player) to each socket
          packages/engine
```

- The server is authoritative. The client imports the engine only to preview whether a play is legal and to get constants for the rules page.
- Shuffling happens only on the server, using a seeded PRNG. The seed and the full action log are stored with the game, so any game can be replayed exactly for debugging.

## 3. Game rules (authoritative for implementation)

This section combines the V3 sheet with the decisions from the design discussion. Items marked **[clarified]** are not on the sheet or resolve an ambiguity in it.

### 3.1 Setup

- Standard 52-card decks, each with 2 Jokers. Deck count = `max(2, ceil(n / 2))`: 2 decks for 2–4 players, 3 for 5–6, and 4 for 7–8.
- Hand size: 15 for 2 players, 13 for 3–8 players.
- Supported player counts: 2–8.
- After the deal, each player lays out any Red 3s face up and draws replacements from the stock. Repeat until nobody holds a Red 3.
- One card is turned up to start the discard pile. **[clarified]** If it is a Red 3 or a wild, it is buried in the stock and another card is turned up; repeat as needed. A wild buried this way freezes the pile for everyone, as if a wild were in the pile.
- The dealer rotates to the left each round. The player to the dealer's left goes first.
- **[clarified]** The Perfect Cut Bonus is not implemented in the online version.

### 3.2 Card values

| Card | Role | Points |
| --- | --- | --- |
| Joker | Wild | 50 |
| 2 | Wild | 20 |
| A | Natural | 20 |
| K, Q, J, 10, 9, 8 | Natural | 10 |
| 7, 6, 5, 4 | Natural | 5 |
| Black 3 | Stop card, never meldable | 5 |
| Red 3 | Bonus card, laid face up | 100 |

**[clarified]** Red 3s score a flat 100 each. There is no bonus for holding all four.

### 3.3 Turn structure

1. **Draw:** draw one card from the stock, or pick up the discard pile (3.6). A drawn Red 3 is laid face up automatically and replaced.
2. **Play:** make any number of meld plays (3.4).
3. **Discard:** discard one card to end the turn. Discarding your last card counts as going out (3.7).

**[clarified] Empty stock:** if the stock is empty when a player must draw, that player may pick up the discard pile if it is legal for them. Otherwise they choose "draw", which ends the round immediately. Nobody gets a going-out bonus, and everyone scores normally (3.8). The round also ends this way if a draw finds only Red 3s left, so there's no replacement card.

### 3.4 Melds

- A meld is 3 or more cards of one natural rank (4 through A), with at least 2 natural cards.
- **Wild ratio [clarified]:** Jokers and 2s together may not outnumber the naturals in a meld (`wilds ≤ naturals`). For example, 3N+2J+1D is legal, and 2N+2D+1J is not.
- 3s can never be melded, Black or Red, even when going out.
- **[clarified] Multiple melds of the same rank are allowed.** A player can start a new meld of a rank they already have, using at least 3 cards that form a valid meld on their own.
- Cards can be added from hand to any of your own melds, including a finished canasta. The meld must still be valid after the addition.
- Melds belong to individual players. You can only add to your own melds.
- **Canasta:** a meld of 7 or more cards. It is *natural* if it contains no wilds (500 bonus) and *mixed* if it contains any wild (300 bonus). **[clarified]** Adding a wild to a natural canasta makes it mixed.
- **Meld play is atomic.** One play submits a batch of new melds and additions to existing melds, and the whole batch is validated together. This is how an initial meld made of several melds reaches its minimum.

### 3.5 Initial meld

- A player's first meld play of a round must add up to a minimum number of points, based on their cumulative score at the start of the round:

| Cumulative score | Minimum |
| --- | --- |
| < 0 | 15 |
| 0 – 1,495 | 50 |
| 1,500 – 2,995 | 90 |
| 3,000+ | 120 |

- **[clarified]** Only card values count toward the minimum. Red 3s and canasta bonuses do not. When the initial meld is made while picking up the pile, the top discard counts, but the rest of the pile does not.

### 3.6 Picking up the discard pile

- The pile is **frozen for a player** if they have not picked it up yet this round (the personal freeze), **or** if a wild is anywhere in the pile (including one buried at the start, per 3.1).
- Nobody can pick up the pile while a **Black 3 or a wild is on top**.
- **Taking the top card:** the top card must be melded immediately, as part of the same play as the pickup. Then the player takes the rest of the pile into their hand.
  - **Frozen for you:** the top card must start a **new** meld with a **natural pair** of the same rank from your hand.
  - **Not frozen for you:** the top card may either (a) start a new meld with a natural pair or a natural plus a wild from your hand, or (b) be added to one of your existing melds of that rank that is **not yet a canasta**.
  - **[clarified] A finished canasta can never take the top card.** For example, a player with a canasta of 5s and no unfinished 5s meld can take a discarded 5 only by starting a new meld of 5s from their hand.
- The pickup play can include other new melds and additions from hand. If this is the player's initial meld, the whole play must meet the minimum from 3.5.
- A successful pickup lifts the personal freeze for the rest of the round. The pile can still be frozen for that player by a wild in it.

### 3.7 Going out

- To go out, a player must have at least 1 canasta after their play. They then either meld every card left in their hand or discard their final card.
- **First-turn restriction:** a player cannot go out on their own first turn of a round.
- **[clarified]** When you are not allowed to go out, a play must leave you at least 2 cards: one to discard and one to keep. Otherwise you would be stuck unable to discard.
- Going out ends the round immediately.

### 3.8 Round scoring

For each player:

- **+** the value of every card in their melds
- **+** 500 for each natural canasta and 300 for each mixed canasta
- **+** 100 for each Red 3 if they made an initial meld this round, **−** 100 for each Red 3 if they did not
- **−** the value of every card left in their hand
- For the player who went out: **+** 100 going-out bonus, and a further **+** 200 concealed hand bonus if they had not melded at all this round before the turn they went out on. **[clarified]** The concealed bonus still applies if they picked up the pile on that turn.

If the round ended because the stock ran out, nobody gets the going-out or concealed bonus.

### 3.9 Winning

The game ends at the end of a round in which at least one player has a cumulative score of 5,000 or more. The highest score wins. **[clarified]** An exact tie for the highest score is shared.

## 4. Engine (`packages/engine`)

### 4.1 Core types

```ts
type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'
type Rank = 'A'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'JOKER'
type NaturalRank = Exclude<Rank, '2' | '3' | 'JOKER'>
type Card = { id: number; rank: Rank; suit: Suit | null }  // id is unique across all decks; suit is null for Jokers

type Meld = { id: string; rank: NaturalRank; cards: Card[] }

type Player = {
  id: string; name: string; score: number
  hand: Card[]; melds: Meld[]; red3s: Card[]
  hasPickedUpPile: boolean       // lifts the personal freeze
  turnsThisRound: number         // first-turn going-out restriction
  meldedBeforeThisTurn: boolean  // concealed hand bonus
}

type Round = {
  number: number; dealer: number; current: number
  stock: Card[]; discard: Card[]
  pileFrozenForAll: boolean      // a wild was buried as the upcard or discarded; cleared when the pile is picked up
  phase: 'draw' | 'play'
  nextMeldId: number
  feed: FeedEvent[]              // public events this round, oldest first; reset at each deal
}

type Played = { newMelds: Card[][]; additions: { meldId: string; cards: Card[] }[] }

type FeedEvent =
  | { type: 'drewStock'; playerId: string; red3s: Card[] }   // Red 3s turned up while drawing
  | { type: 'pickedUpPile'; playerId: string; count: number; played: Played }   // count includes the top card
  | { type: 'melded'; playerId: string; played: Played }
  | { type: 'discarded'; playerId: string; card: Card }
  | { type: 'wentOut'; playerId: string }
  | { type: 'stockOut' }

type Seed = [number, number, number, number]   // four u32s: 128 bits of PRNG state

type Game = {
  players: Player[]; round: Round | null; history: RoundScore[]
  status: 'lobby' | 'playing' | 'roundOver' | 'gameOver'
  seed: Seed; log: Action[]
  winners: string[]
}
```

Canasta status is derived from a meld's cards; it is never stored.

### 4.2 Actions

```ts
type MeldBatch = { newMelds: CardId[][]; additions: { meldId: string; cardIds: CardId[] }[] }

type Action =
  | { type: 'drawStock' }
  | { type: 'pickUpPile'; play: MeldBatch }   // the batch must place the top discard
  | { type: 'meld'; play: MeldBatch }         // repeatable during the play phase
  | { type: 'discard'; cardId: CardId }
```

When a pickup's top card needs to go into a new meld or be added to a meld, `CardId` refers to it by its id, the same as a card from hand.

Lobby and round actions (`startGame`, `startNextRound`) are separate engine functions, not player turn actions.

### 4.3 Public API

```ts
applyAction(game, playerId, action): { ok: true; game: Game } | { ok: false; error: RuleError }
viewFor(game, playerId): PlayerView   // other hands shown as counts, the stock as a count, seed and log removed
removePlayer(game, playerId): GameResult  // lobby only; throws for an unknown id
legalityPreview(view, action): RuleError | null  // client-side check against a PlayerView (view.you is the acting player)
```

`RuleError = { code: RuleErrorCode; message: string }`. Every rejected action returns a specific code, for example `FROZEN_NEEDS_NATURAL_PAIR`, `WILDS_EXCEED_NATURALS`, `INITIAL_MELD_TOO_LOW`, `CANNOT_GO_OUT_FIRST_TURN`, or `CANASTA_CANNOT_TAKE_PILE`. The engine never throws for rule violations. It throws only for programmer errors, such as an unknown card id.

`PlayerView` includes the round's `feed`. Every card in it was face up when the event happened, so the feed can show cards that a pickup has since moved into a hand. That matches a physical table, where players see each discard. When a round ends, every player's remaining hand is stored with its score (`RoundScore.hands`). The scoreboard can show the hands even after someone deals the next round.

Rule constants (card values, initial meld minimums, the deck and hand-size functions, bonus values, the winning score) are exported, so the rules page renders from the same source.

### 4.4 Modules

| Module | Responsibility |
| --- | --- |
| `cards` | Card helpers: `isWild`, `isNatural`, `isRed3`, `isBlack3` |
| `constants` | Rule constants: card values, bonuses, tiers, deck/hand sizing, winning score |
| `rng` | Seeded PRNG (sfc32, 128-bit seed) and shuffle |
| `deck` | Deck construction for a given number of decks |
| `errors` | Rule error codes, their rules-page sections, and the `RuleError` constructor |
| `types` | Core type definitions: `Card`, `Player`, `Round`, `Game`, `Action`, etc. |
| `clone` | Deep-clones a `Game` so actions can produce new state without mutating the input |
| `meldRules` | Validity of new melds and additions (3.4) |
| `pileRules` | Freeze status and pickup legality (3.6) |
| `turnRules` | Turn/phase checks, discard legality, and the going-out restrictions (3.3, 3.7) |
| `play` | Validates a meld/pickup batch against a hand and pile, and applies it |
| `scoring` | Round scoring and end-of-game detection (3.8, 3.9) |
| `round` | Dealing, turn advancement, and ending a round |
| `game` | Lobby management: `createGame`, `addPlayer`, `removePlayer`, `startGame`, `startNextRound` |
| `actions` | `applyAction`, the engine's per-turn action dispatcher |
| `view` | `viewFor` and hiding private information |
| `preview` | `legalityPreview`, the client-side legality check against a `PlayerView` |
| `index` | Public exports |

## 5. Server (`apps/server`)

- **Routes.**
  - `POST /api/games` creates a GameRoom with a random 6-character code and returns `{ code }`.
  - `GET /api/games/:code/ws` upgrades to a WebSocket connected to that game's GameRoom.
- **GameRoom Durable Object.**
  - Uses the WebSocket Hibernation API, so idle games cost nothing.
  - Saves the `Game` to DO storage after every successful action.
  - Seats 2–8 players. The first player to join is the host. Only the host can start the game, kick a player from the lobby, and issue a rejoin token. Any seated player can start the next round, so a missing host can't stall the table.
  - If the host leaves the lobby, the next player in seat order becomes the host.
- **Protocol.** Every message is JSON. Incoming messages are validated with zod before they reach the engine.
  - Client to server: `join {name, token?}`, `start`, `action {action}`, `nextRound`, `leave`, `kick {playerId}`, `reissue {playerId}`.
  - Server to client: `joined {playerId, token}`, `state {view, hostId, connected}` (sent to each socket with its own view), `error {code, message}` (sent only to the socket that caused it), `removed {reason}` (sent to a socket whose seat was given up or kicked), `reissued {playerId, token}` (sent only to the host), `seatReissued {playerId}` (sent to every joined socket).
- **Identity.**
  - There are no accounts. `join` without a token takes a new seat, which is only possible in the lobby, and returns a random token. The client saves the token in localStorage keyed by game code.
  - `join` with a known token reattaches that seat. An unknown token (from a seat that was left, kicked or reissued) is rejected with `UNKNOWN_TOKEN` at any game status, never turned into a new seat, so a stale token can't leave a ghost seat in the lobby. The client then forgets the token and asks for a name.
  - `leave` gives up your seat, and `kick {playerId}` lets the host remove another player. Both work only in the lobby. The removed seat's tokens stop working, and its sockets get `removed` and become unjoined.
  - `reissue {playerId}` lets the host get a new token for a player who is not connected, at any game status. It replaces that player's old tokens. The host shares it as a rejoin link, so a player who lost their token or changed devices gets their seat back. The whole table is told about every reissue, so the host can't quietly take over a seat and read its hand.
- **Disconnects.** The game waits. v1 has no turn timers.

## 6. Client (`apps/web`)

### 6.1 Pages

- `/`: create a game, or join one by code. Includes a name field.
- `/g/:code`: the lobby (seated players, host start button), then the table.
- `/rules`: the rules page (Section 7).

### 6.2 Table

- **Your hand:** sorted by rank, and cards are selected by clicking.
- **Staging area:** builds a `MeldBatch` from selected cards (new meld, or add to one of your melds) and shows a live legal/illegal preview from `legalityPreview`. Buttons: **Meld**, **Pick up pile**, **Discard**, **Clear**.
- **Your melds:** grouped by rank, with finished canastas marked natural or mixed.
- **Opponent panels:** name, card count, melds, Red 3s, cumulative score, and a current-turn highlight.
- **Center:** stock count, the top discard, pile size, and a *Frozen for you* badge with the reason.
- **Errors:** shown as a toast with the rule message and a "Why?" link to that rule's section on the rules page.
- **Action feed:** a short list of the round's public events, newest first (for example "Ann picked up 9 cards", "Bob discarded 7♥").
- **Round-end scoreboard:** each player's scoring breakdown (3.8), their revealed hand, and cumulative totals. Every player sees a **Next round** button.
- **Lobby controls:** a **Leave** button for everyone, and a **Kick** button per player for the host. During the game, the host can copy a rejoin link for a player who is not connected.
- **Game-over screen:** the winner and the final totals.

### 6.3 Local development

`wrangler dev` runs the Worker and Durable Object. Vite's dev server proxies `/api` (including WebSockets) to it.

## 7. Rules page

A page that looks good and is pleasant to read. It is available at `/rules`, and during a game it also opens in a slide-over drawer, so players can check a rule without leaving the table.

- **Content:** every rule from Section 3, in the order a new player needs it: Overview → Setup → Card values → Your turn → Melds and canastas → Initial meld → Picking up the pile → Going out → Scoring → Winning.
- **House clarifications:** called out visually wherever they apply, and also gathered into a "Our house rules vs. standard Canasta" summary, so experienced Canasta players can see the differences at a glance.
- **Single source of truth:** tables and numbers (card values, initial meld minimums, the deck and hand-size table, bonuses) render from the engine's exported constants, so the page cannot drift from the code.
- **Worked examples with real card faces:** rendered with the same card component as the table. Examples include valid and invalid melds, frozen and unfrozen pickups, the canasta-can't-take-the-pile case, and a full round scoring breakdown. Each example is stored as data with an expected result, and an engine test checks every example against `meldRules`, `pileRules` and `scoring`, so the examples are guaranteed correct.
- **Navigation:** a sticky table of contents on desktop and a collapsible one on mobile. Every section has an anchor, and each `RuleErrorCode` maps to one, which powers the "Why?" links from error toasts.
- **Quick reference card:** a compact summary of point values, minimums and bonuses at the top of the page.
- **Print stylesheet:** printing the page produces a clean rule sheet.
- Works at phone width.

## 8. Testing

- **Engine (Vitest), the bulk of the tests.**
  - Table-driven tests for each rule module. Every rule in Section 3, and every [clarified] item in particular, has at least one named test.
  - Rules page examples are checked against the engine (Section 7).
  - A seeded simulation plays thousands of random legal games to completion and checks invariants after every action: the total card count stays constant, card ids stay unique, `viewFor` never exposes another player's hand or the stock contents, and each round's score equals the sum of its breakdown.
- **Server:** `@cloudflare/vitest-pool-workers` integration tests against a real GameRoom: create, join, host start, action round trip, error reaches only the sender, reconnect with a token, and each socket's view is redacted.
- **Client:** a small number of component tests for the staging area and the rules page examples. Otherwise manual playtesting.
- **Tooling:** strict TypeScript, ESLint, Prettier, and an `npm test` at the root that runs every workspace.

## 9. Out of scope for v1

Accounts, AI bots, chat, drag-and-drop, animations, turn timers, spectators, the Perfect Cut Bonus, and game history across sessions.
