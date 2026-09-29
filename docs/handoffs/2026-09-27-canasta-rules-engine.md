---
created: 2026-09-27T19:40:06Z
updated: 2026-09-28
branch: main
trigger: manual
restored: false
topic: canasta-rules-engine
---

# Handoff: Building Cutthroat Canasta (engine and server done; Plan 3 web client ready to execute)

## Goal

Build an online version of our house Cutthroat Canasta rules (V3 sheet) for 2–8 players on separate devices. The stack is a TypeScript npm-workspaces monorepo: a pure rules engine, a Cloudflare Workers server, and a React + Vite client with a rules page. The current work is Plan 1, the rules engine (`packages/engine`).

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

### Plan 3: web client and rules page (planned, not started)

- The plan is `docs/superpowers/plans/2026-09-28-web-client.md`: 11 tasks, about 5,300 lines.
  - A drafting agent ran all its code in a scratch copy of the repo. 223 engine, 90 server and 56 web tests passed, the build was clean, and a live socket through the Vite proxy to `wrangler dev` worked.
- Read its **Amendments** section first. It records the user's decisions of 2026-09-28, and it overrides the task text:
  - Presence is minimal, with no alarm.
  - The heartbeat pings every 20 s, and a socket is stale after 70 s.
  - Add `GET /api/games/:code` (200 or 404). This is in Task 2, with the client side in Tasks 3 and 4.
- **Execution mode (user's choice):** task by task, as in Plans 1 and 2, on a new branch `feat-web-client`. A fresh implementer per task, a spec and quality review after each, and a final whole-branch review. No code has been written yet.
- **Stack:** React 19.3, React Router 8.4, Vite 8.3, CSS modules, and the root Vitest 5 with jsdom 29. Use jsdom 29, not 30, because jsdom 30 needs Node 24.15 and this machine has 24.10.
- The worked examples live in the engine (`@canasta/engine/examples`), because an engine test can't import from `apps/web`.
- The "Standard Canasta" column of the house-rules table was checked against the classic partnership rules. The concealed-bonus row was made explicit: standard pays 200 instead of 100.

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

## Modified Files

Committed on `main` since `6abf692` (via `feat-initial-game`):

- Root: `package.json`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `README.md`
- `packages/engine/`: `package.json`, `tsconfig.json`
- `packages/engine/src/`: `cards.ts`, `constants.ts`, `rng.ts`, `deck.ts`, `errors.ts`, `types.ts`, `meldRules.ts`, `pileRules.ts`, `turnRules.ts`, `play.ts`, `scoring.ts`, `clone.ts`, `round.ts`, `game.ts`, `actions.ts`, `view.ts`, `preview.ts`, `index.ts`
- `packages/engine/test/`: `fixtures.ts`, `cards.test.ts`, `constants.test.ts`, `rng.test.ts`, `deck.test.ts`, `meldRules.test.ts`, `pileRules.test.ts`, `turnRules.test.ts`, `play.test.ts`, `scoring.test.ts`, `game.test.ts`, `actions.test.ts`, `view.test.ts`, `preview.test.ts`, `simulation.test.ts`

## Failed Approaches

- **Task 1 initially skipped `format:check`.** The plan's code was not Prettier-formatted, so implementers now run `npm run format` and `format:check` before every commit.
- **The first README draft misstated three rules** (Black 3s, personal freeze, concealed bonus). It was corrected in `f619980`. Check any rules prose against spec Section 3.

## Files to Read

- `docs/superpowers/specs/2026-09-27-cutthroat-canasta-design.md`: the spec. Section 3 is the rules authority.
- `docs/superpowers/plans/2026-09-27-engine.md`: the engine plan (10 tasks, with full code). Complete.
- `docs/superpowers/plans/2026-09-27-server.md`: the server plan (6 tasks). Note: `apps/server` needs its own Vitest 4, because `@cloudflare/vitest-pool-workers@0.22` requires `vitest ^4.1`, while the root and engine use Vitest 5.
- `Cutthroat_Canasta_House_Rule_Sheet_V3.docx.pdf`: the original house rule sheet (provided in chat, not in the repo).

## Next Steps

1. `git checkout -b feat-web-client` from `main`, then execute Plan 3 task by task. Apply the Amendments section. Run `npm run format` and the full checks before each commit.
2. After Task 8 there is a manual playtest with 2 or more browser windows (`npm run dev:server` plus `npm run dev:web`).
3. When all 11 tasks are done, run a final whole-branch review, fix what it finds, fast-forward merge to `main`, push, and delete the branch.
4. Deployment is deferred: Workers static assets, and `wrangler deploy` needs the user's Cloudflare account.
5. Optional engine polish: make the simulation bot prefer going out, and tighten the test fixture `meld()` so it excludes 3s.

## Open Questions

These came from the Plan 2.5 review. The first two are decided; the rest are open:
- **Host can take a disconnected seat (decided: announce).** Every reissue now sends `seatReissued` to the whole table. A player who reconnects later misses the notice. The client should show it in the table feed.
- **Half-open sockets.** A dead phone's socket still counts as connected until Cloudflare notices, so `reissue` is refused with `PLAYER_CONNECTED`. Fix with a client heartbeat plus a last-seen time (Plan 3).
- **An early `nextRound` wipes the round-end review (decided: history).** The hands are now kept in `RoundScore.hands`. The round's feed still resets when the next round is dealt.
- **No host after a mid-game token loss.** If the host loses their token, nobody can reissue any token.
- **Feed payload** grows with the square of the round length, because every broadcast resends the whole feed. Watch it. If it matters, send only the new events.
- Any rule change should update spec Section 3 first.
