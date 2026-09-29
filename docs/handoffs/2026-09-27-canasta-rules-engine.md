---
created: 2026-09-27T19:40:06Z
updated: 2026-09-29
branch: main
trigger: manual
restored: false
topic: canasta-rules-engine
---

# Handoff: Building Cutthroat Canasta (engine, server and web client merged; manual playtest next)

## Goal

Build an online version of our house Cutthroat Canasta rules (V3 sheet) for 2–8 players on separate devices. The stack is a TypeScript npm-workspaces monorepo: a pure rules engine, a Cloudflare Workers server, and a React + Vite client with a rules page. Plans 1 (engine), 2 and 2.5 (server) are merged. Plan 3 (web client, `apps/web`) passed its final review and is merged to `main`. The user chose to merge before the manual playtest.

## Current State

Plan 1 is complete. It was executed with subagent-driven development: a fresh implementer per task, a spec-and-quality review after each, and a final whole-branch review on the most capable model. That review passed after one fix pass.

| Task | Status | Commits |
| --- | --- | --- |
| 1. Workspace setup, cards, constants | Done, reviewed | `74775bd`, `23b5c22` |
| 2. Seeded RNG, deck | Done, reviewed | `966d8f3` |
| 3. Errors, types, fixtures, meld rules | Done, reviewed | `b197c4b` |
| 4. Discard pile rules | Done, reviewed | `0d69035`, `8524ae7` |
| 5. Turn rules and play validation | Done, reviewed | `3263d7f` |
| 6. Round scoring | Done, reviewed | `026d838` |
| 7. Game lifecycle and dealing | Done, reviewed | `ee47c30` |
| 8. Player actions (`applyAction`) | Done, reviewed | `a76fd1b` |
| 9. Views, legality preview, exports | Done, reviewed | `d78d8fd` |
| 10. Random-game simulation and README | Done, reviewed | `6cb38f9` |
| Final review fixes | Done, re-reviewed | `1f2e080`, `472e039` |

- The README was rewritten early at the user's request (`9a10fe3`, `f619980`).
- All 187 engine tests pass, including a 30-seed random-game simulation. Over those games the bot made 2,726 melds and 349 pickups, formed 203 canastas, and ended 13 rounds by going out. Typecheck, lint and `format:check` are clean.
- `feat-initial-game` was merged into `main` (fast-forward), pushed to origin, and deleted.

### Plan 2: server (`feat-server`)

| Task | Status | Commits |
| --- | --- | --- |
| 1. Server package and Workers test harness | Done, reviewed | `90497f8`, `a652490` |
| 2. Game codes and seeds | Done, reviewed | `ecc8e83` |
| 3. Client/server protocol | Done, reviewed | `b3aa135`, `429b77e` |
| 4. Room message handler | Done, reviewed | `6a5685d` |
| 5. GameRoom Durable Object and routes | Done, reviewed | `9f9c970` |
| 6. Dev workflow, bundle check, docs | Done, reviewed | `f93e58f` |
| Final review fixes | Done, re-reviewed | `1cc96cf`, `bdab845`, `b51a0a8` |

Plan 2 is complete: 62 server tests plus 187 engine tests pass, and the Worker bundles (795 KiB, 127 KiB gzipped). The final review added presence (`connected` in `state`), normalized player names, and pinned the test pool to exactly `0.22.0`.

### Plan 2.5: pre-client changes (`feat-pre-client`, merged)

The user settled the four open questions on 2026-09-28, choosing the recommended option each time. Plan: `docs/superpowers/plans/2026-09-28-pre-client.md`. The spec (Sections 4–6) was updated first.

| Change | Commits |
| --- | --- |
| Spec and plan | `b0f9c5b` |
| sfc32 and a 128-bit `Seed` tuple | `dcbb1bf` |
| Public per-round feed (`Round.feed`, `RoundView.feed`) | `73065a5` |
| `revealedHand` at round end (later replaced by `RoundScore.hands`), `removePlayer` | `c67831d` |
| `leave`, `kick`, `reissue`; any player deals the next round | `6930a54` |
| README | `59c2a61` |
| Review fixes (empty-stock draw event, kick text) | `bd10829` |
| Hands kept in `RoundScore.hands`; reissues announced to the table | `4ca647a` |

206 engine and 86 server tests pass. A whole-branch review found no critical bugs and no leaks. The simulation's leak check now counts any card that was face up this round as public. A planted leak still fails all 30 seeds.

### Plan 3: web client and rules page (`feat-web-client`, not merged)

The plan is `docs/superpowers/plans/2026-09-28-web-client.md`. Its Amendments (decided 2026-09-28) override the task text: minimal presence with no alarm, a 20 s ping with a 70 s stale limit, and `GET /api/games/:code`. It was executed task by task: a fresh implementer per task and a review after each. Review fixes went in as separate commits.

| Task | Status | Commits |
| --- | --- | --- |
| 1. Web package scaffold and tooling | Done, reviewed | `75b915a` |
| 2. Server heartbeat, stale sockets, `GET /api/games/:code` | Done, reviewed | `efc74c7`, fixes `1fb78b0`, `628517d` |
| 3. Protocol client (connection, api, storage) | Done, reviewed | `70018f1`, fixes `289b404`, `7a3fbe8` |
| 4. Game state, routing, home, join, lobby | Done, reviewed | `fec7476`, fixes `628517d`, `7a3fbe8` |
| 5. Cards and table panels | Done, reviewed | `48a211e`, fixes `af336e4` |
| 6. Staging area | Done, reviewed | `615ce0e`, fixes `af23d67` |
| 7. Feed, round-end scoreboard, game over | Done, reviewed | `7cf22c1`, fixes `af23d67` |
| 8. Assemble the table | Done (manual playtest pending) | `a7d7f25`, fixes `af23d67` |
| 9. Engine-checked rules examples and tables | Done, reviewed | `b2668d8`, fixes (G) `15d7127` |
| 10. Rules page and in-game drawer | Done (by-hand page check pending) | `4ca58ef`, fixes `ec0480d` |
| 11. Documentation | Done | `fc5459b` |
| Final review fixes (H) | Done, re-reviewed | `b7d8679`, `79d1d75` |
| Final review follow-up (I) | Done | this commit |

The final whole-branch review said READY TO MERGE after the (H) fixes. (I) only adds a retry hint to the `PLAYER_CONNECTED` message and corrects the ghost-seat note.

- **Tests:** 224 engine, 97 server and 78 web tests pass. Typecheck, lint and `format:check` are clean. `vite build` gives about 312 kB of JS (99 kB gzipped), and the bundle has no `zod` and no `parseClientMessage`.
- **Smoke runs:** scripted runs through the Vite proxy to `wrangler dev` passed. They covered create, lookup (200 and 404), join, start, hidden hands, an out-of-turn refusal, draw, discard, the feed, reissue and rejoin, a stale token refused, and ping and pong. Nobody has played it in a browser yet.

**Deviations from the plan's text:**
- `GamePage` is split into `Game` and `Session`. `Game` reads the link token, clears the hash at once and calls `gameExists`. On false it shows "There's no game with the code …" and never connects. `Session` owns `useGame`. The rules drawer lives in `Session`, so opening it never unmounts the connection. Task 10's "final form" of `GamePage` was not used, because it predates the amendment.
- **Client heartbeat.** Liveness comes from an unanswered ping, not from silence: a ping unanswered for `PONG_TIMEOUT_MS` (10 s) drops the socket. The plan's 45 s silence limit would have killed healthy background tabs, whose timers run about once a minute. When the page is shown, the client pings at once. A ping that is already waiting keeps its deadline.
- **Server presence.** The room also broadcasts when a stale socket is dropped during a rejected or malformed message.
- **`UNKNOWN_TOKEN`.** A `join` with a token that belongs to no seat is refused at any status. Before, in the lobby, it silently took a second seat. Spec Section 5 and the README were updated. The client deletes the token and shows the join form with the error. A failed join also clears the old `playerId` and view.
- **Staging.**
  - An action that can't be sent (the socket is down) keeps the staging and shows a "Not connected" toast. Action buttons are disabled while the socket isn't open.
  - The stored staging is pruned whenever the view prunes it.
  - A staged top discard is marked in the pile.
- **Rules examples.** Pickup examples are checked with the full `validatePlay`, in realistic states: prior melds whenever the pile was already picked up, a score, a pile size and a kept hand. There is a new example for the initial meld on a pickup, where only the top card counts toward the minimum. The Black 3 example uses a natural pair under the Black 3.
- **Rules page.** The quick reference "Goal" now says the highest total wins after someone reaches 5,000 (it said "first to 5,000"). The freeze note is hidden when the top card itself blocks the pile.
- **Smaller fixes:**
  - Melds are sorted and named by rank ("Aces", "Kings").
  - Presence dots have text labels.
  - Copying a rejoin link works without the Clipboard API.
  - The table header shows "Round over" or "Game over", and the final round's scoreboard stays up at game over.
  - Seat notices clear each round.
  - Modified clicks on **Why?** navigate normally.
  - The README's "House rules at a glance" had three wrong lines: Black 3s blocked only "the next player", "first to 5,000 wins", and a vague concealed bonus. All three were corrected against spec Section 3.

## Key Decisions

- **Stack:** Cloudflare Workers with one Durable Object per game; React + Vite; one engine shared by server and client. boardgame.io was rejected because its server needs Node and it is barely maintained.
- **Server is authoritative.** The client imports the engine only to preview legality and to render the rules page.
- **House-rule clarifications** (spec Section 3, marked [clarified]):
  - All wilds together (Jokers and 2s) must be ≤ naturals in a meld.
  - Pickup follows standard Canasta: the top card is melded at once. Frozen: a natural pair from hand. Unfrozen: a natural pair, a natural plus a wild, or adding to an unfinished meld of that rank.
  - Multiple melds of the same rank are allowed. A finished canasta can't take the top discard.
  - Empty stock: "draw" ends the round with no going-out bonus. It also ends if a draw finds only Red 3s.
  - A player who can't go out must keep at least 2 cards after melding.
  - Perfect Cut Bonus is dropped online. Ties for the win are shared. The concealed bonus still applies with a pickup on the going-out turn.
- **Pickup check order (Task 4):** when the pile is frozen for the player, the freeze error is reported before the "canasta can't take the pile" error. This overrides the plan's original order, because the freeze message is more accurate (the pair must be natural).
- **Unknown action types throw** in `applyAction` and `legalityPreview`, as a programmer error. The Plan 2 server must validate action shape (with zod) before calling the engine.
- **Duplicate player ids are rejected** with `DUPLICATE_PLAYER`, so a reconnect must reattach the existing seat, never call `addPlayer` again.
- **Deferred to Plans 2 and 3:** revealing everyone's hands at round end, and a public action feed. `viewFor` currently hides other hands even after the round, and it removes the log.
- **Commits:** plain imperative messages with no attribution lines. The user's CLAUDE.md forbids them, and a hook rejects them.
- **Commit email:** GitHub rejects pushes that expose `ccecil@wisc.edu` (GH007). This repo's local `user.email` is now `764336+thatRailsGuy@users.noreply.github.com`. Plan 2.5's commits were re-authored to it before they were pushed. Never rewrite pushed history.
- **Server tooling (Plan 2, Task 1):**
  - `apps/server` pins `wrangler` to exactly `4.124.0`, the version `@cloudflare/vitest-pool-workers@0.22.0` pins, so the tree has one workerd build. `compatibility_date` is `2026-08-22`, the newest that workerd accepts. Bump the pool and wrangler together.
  - Server tests use `SELF` from `cloudflare:test`, because typing `exports` from `cloudflare:workers` failed.
- **Lockfile gotcha:** an incremental `npm install` on this tree strips platform-specific optional entries (rolldown and esbuild bindings; npm/cli#4828). To change dependencies, regenerate cleanly: `rm -rf package-lock.json node_modules apps/*/node_modules packages/*/node_modules && npm install --package-lock-only --ignore-scripts && npm ci`. Then check that `grep -c '@rolldown/binding-' package-lock.json` is non-zero.
- **Prettier ignores** `docs/`, `.superpowers/` and `package-lock.json`. README.md is formatted.
- **Web tooling (Plan 3):**
  - `apps/web` uses the root Vitest 5 and doesn't declare its own. Only `apps/server` needs Vitest 4.
  - Tests run in jsdom 29, because jsdom 30 needs Node 24.15 and this machine runs 24.10.
  - The web app may import only types from `@canasta/server`, and an ESLint rule enforces it.
- **Heartbeat constants** (`apps/server/src/protocol.ts`):
  - `HEARTBEAT_PING` and `HEARTBEAT_PONG` are answered by a Durable Object auto-response, which doesn't wake the room.
  - The client pings every `HEARTBEAT_INTERVAL_MS` (20 s). Its copies of the ping string and interval are typed against the server's literal types, so a mismatch fails the typecheck.
  - A socket that has sent nothing for `STALE_AFTER_MS` (70 s) is unbound and closed with `STALE_CLOSE_CODE` (4000) before the room handles the next message or close.
- **Rules examples** live in the engine as `@canasta/engine/examples`, a separate package export that isn't in the main index. An engine test checks each one with `validatePlay` or `scoreRound`.

## Modified Files

Committed on `main` since `6abf692` (via `feat-initial-game`):

- Root: `package.json`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `README.md`
- `packages/engine/`: `package.json`, `tsconfig.json`
- `packages/engine/src/`: `cards.ts`, `constants.ts`, `rng.ts`, `deck.ts`, `errors.ts`, `types.ts`, `meldRules.ts`, `pileRules.ts`, `turnRules.ts`, `play.ts`, `scoring.ts`, `clone.ts`, `round.ts`, `game.ts`, `actions.ts`, `view.ts`, `preview.ts`, `index.ts`
- `packages/engine/test/`: `fixtures.ts`, `cards.test.ts`, `constants.test.ts`, `rng.test.ts`, `deck.test.ts`, `meldRules.test.ts`, `pileRules.test.ts`, `turnRules.test.ts`, `play.test.ts`, `scoring.test.ts`, `game.test.ts`, `actions.test.ts`, `view.test.ts`, `preview.test.ts`, `simulation.test.ts`

On `feat-web-client` (Plan 3):

- Root: `package.json` (`dev:web`, `eslint-plugin-react-hooks`), `package-lock.json`, `eslint.config.js`, `README.md`
- `apps/web/`: the whole package (`src/` with `pages/`, `components/` and `rules/`, plus `test/`)
- `apps/server/src/`: `presence.ts` (new), `protocol.ts`, `gameRoom.ts`, `room.ts`, `index.ts`; `apps/server/test/`: `presence.test.ts` (new), `worker.test.ts`, `room.test.ts`
- `packages/engine/`: `package.json` (the `./examples` export), `src/examples.ts` and `test/examples.test.ts` (new)
- `docs/superpowers/specs/2026-09-27-cutthroat-canasta-design.md` (Section 5, `UNKNOWN_TOKEN`)

## Failed Approaches

- **Plan 3, silence-based client liveness.** The plan's first design dropped a socket after 45 s of silence. Background tabs, whose timers run about once a minute, would have reconnected every minute. It was replaced by a pong timeout on each ping (`289b404`).
- **Plan 3, examples checked with partial rules.** The pickup examples were first checked only with `checkPickupShape` and `checkMeldCards`, which missed an illegal initial meld shown as Legal. They now run the full `validatePlay` (`15d7127`).

- **Task 1 initially skipped `format:check`.** The plan's code was not Prettier-formatted, so implementers now run `npm run format` and `format:check` before every commit.
- **The first README draft misstated three rules** (Black 3s, personal freeze, concealed bonus). It was corrected in `f619980`. Check any rules prose against spec Section 3.

## Files to Read

- `docs/superpowers/specs/2026-09-27-cutthroat-canasta-design.md`: the spec. Section 3 is the rules authority.
- `docs/superpowers/plans/2026-09-27-engine.md`: the engine plan (10 tasks, with full code). Complete.
- `docs/superpowers/plans/2026-09-28-web-client.md`: the web client plan (11 tasks). Read its Amendments first. The by-hand checks are Task 4 Step 6, Task 8 Step 3 and Task 10 Step 4.
- `docs/superpowers/plans/2026-09-27-server.md`: the server plan (6 tasks). Note: `apps/server` needs its own Vitest 4, because `@cloudflare/vitest-pool-workers@0.22` requires `vitest ^4.1`, while the root and engine use Vitest 5.
- `Cutthroat_Canasta_House_Rule_Sheet_V3.docx.pdf`: the original house rule sheet (provided in chat, not in the repo).

## Next Steps

1. **Manual playtest:** follow `docs/playtest.md` (setup, phones over Wi-Fi, and the full checklist). It supersedes the by-hand steps in Plan 3 (Task 4 Step 6, Task 8 Step 3, Task 10 Step 4). Fix what it finds on a new branch from `main`.
2. **Final whole-branch review:** done. It said READY TO MERGE after the (H) fixes, and (I) followed.
3. **Merge:** done. `feat-web-client` was fast-forwarded into `main`, pushed and deleted.
4. Deployment is deferred: Workers static assets, and `wrangler deploy` needs the user's Cloudflare account.
5. Optional engine polish: make the simulation bot prefer going out, and tighten the test fixture `meld()` so it excludes 3s.

## Open Questions

Decided or fixed:
- **Host can take a disconnected seat (decided: announce).** Every reissue sends `seatReissued` to the whole table, and the client shows it in the feed area for the rest of that round. A player who reconnects later misses it.
- **Half-open sockets (fixed in Plan 3).** A socket that has been silent for 70 s is unbound and closed, but only when the room next wakes: pings are auto-responded and never wake it. So the host sees **Seat stuck? Make rejoin link** on every connected opponent, as well as the prominent control for a disconnected one. The reissue request wakes the room, the stale drop runs first, and a dead phone's seat is then reissued. A live player's seat is refused with `PLAYER_CONNECTED` ("Bob is still connected… If they're stuck, try again in a minute."), shown as a toast. This covers a phone that dies on its own turn, when nobody else can act.
- **An early `nextRound` wipes the round-end review (decided: history).** The hands are kept in `RoundScore.hands`, and the round's feed resets when the next round is dealt.
- **Plan 3's three questions (decided 2026-09-28):** minimal presence with no alarm, a 20 s ping with a 70 s stale limit, and `GET /api/games/:code`.

Still open:
- **Stale dot until the next event.** Nothing wakes the room when a socket goes stale, so everyone sees a dead player's green dot until the next message, close or error in that room. The host's **Seat stuck?** button is the way out of a stall. A Durable Object alarm would refresh the dots on its own, at the cost of waking the room.
- **No host after a mid-game token loss.** If the host loses their token, nobody can reissue any token.
- **Feed payload** grows with the square of the round length, because every broadcast resends the whole feed. Watch it. If it matters, send only the new events (only `gameState.ts` would change).
- **A rejoin link overwrites a saved token.** Opening `/g/CODE#token=…` on a device that already holds a token for that game replaces it without asking. If the device was seated as someone else, that seat's token is lost from this device.
- **`UNKNOWN_TOKEN` costs a click.** A player coming from the home page with a stale saved token sees the error, then the join form with their name filled in. There is no silent retry by name. Mid-game, the message says to ask the host for a new rejoin link, but the join form still shows: an unjoined socket gets no state, so the client can't tell the game has started. Joining by name there gets `NOT_IN_LOBBY`.
- **Ghost-seat race.** If the socket drops after the server accepts a name join but before `joined` arrives, the client has no token. The next open joins by name again, which is refused with `NAME_TAKEN`, because names are unique case-insensitively. The player sees that error on the join form, and the first seat is left as an orphan that only a kick removes (lobby only). A client-generated join id, or a token sent before the join, would close it.
- **Two tabs in one browser share a token.** The key is `canasta:token:<CODE>`, so a second tab in the same profile joins as the same seat: both tabs show that player's hand and can act for them. Playtest with separate browser profiles.
- **Toasts are hidden while the rules drawer is open.** The drawer is a modal `<dialog>` in the top layer, so rule-error toasts and "Not connected" toasts sit behind it until it closes.
- Any rule change should update spec Section 3 first.
