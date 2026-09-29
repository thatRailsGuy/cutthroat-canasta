---
created: 2026-09-27T19:40:06Z
branch: main
trigger: manual
restored: false
topic: canasta-rules-engine
---

# Handoff: Building the Cutthroat Canasta rules engine (Plan 1 of 3)

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

209 engine and 86 server tests pass. A whole-branch review found no critical bugs and no leaks. The simulation's leak check now counts any card that was face up this round as public. A planted leak still fails all 30 seeds.

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

1. `feat-pre-client` is merged to `main`.
2. Write Plan 3 (web client and rules page). The rules page renders from the engine constants and uses `RULE_ERROR_SECTIONS` for its "Why?" links. The client needs a heartbeat, so half-open sockets don't show as connected.
3. Optional engine polish: make the simulation bot prefer going out, and tighten the test fixture `meld()` so it excludes 3s.

## Open Questions

These came from the Plan 2.5 review. The first two are decided; the rest are open:
- **Host can take a disconnected seat (decided: announce).** Every reissue now sends `seatReissued` to the whole table. A player who reconnects later misses the notice. The client should show it in the table feed.
- **Half-open sockets.** A dead phone's socket still counts as connected until Cloudflare notices, so `reissue` is refused with `PLAYER_CONNECTED`. Fix with a client heartbeat plus a last-seen time (Plan 3).
- **An early `nextRound` wipes the round-end review (decided: history).** The hands are now kept in `RoundScore.hands`. The round's feed still resets when the next round is dealt.
- **No host after a mid-game token loss.** If the host loses their token, nobody can reissue any token.
- **Feed payload** grows with the square of the round length, because every broadcast resends the whole feed. Watch it. If it matters, send only the new events.
- Any rule change should update spec Section 3 first.
