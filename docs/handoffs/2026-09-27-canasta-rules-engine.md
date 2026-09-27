---
created: 2026-09-27T19:40:06Z
branch: feat-initial-game
trigger: manual
restored: false
topic: canasta-rules-engine
---

# Handoff: Building the Cutthroat Canasta rules engine (Plan 1 of 3)

## Goal

Build an online version of our house Cutthroat Canasta rules (V3 sheet) for 2–8 players on separate devices. The stack is a TypeScript npm-workspaces monorepo: a pure rules engine, a Cloudflare Workers server, and a React + Vite client with a rules page. The current work is Plan 1, the rules engine (`packages/engine`).

## Current State

The plan is being executed with subagent-driven development: a fresh implementer per task, then a spec-and-quality review, then fix rounds. Progress is tracked here and in the ledger (see Files to Read).

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

- The README was rewritten early at the user's request (`9a10fe3`, `f619980`).
- The engine tests pass (184 including the 30-seed simulation). Typecheck, lint and `format:check` are clean.
- After Plan 1: write Plan 2 (server) and Plan 3 (web client and rules page) against the engine's real API.

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
- **Commits:** plain imperative messages with no attribution lines. The user's CLAUDE.md forbids them, and a hook rejects them.
- **Prettier ignores** `docs/`, `.superpowers/` and `package-lock.json`. README.md is formatted.

## Modified Files

Committed on `feat-initial-game` since `6abf692`:

- Root: `package.json`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `README.md`
- `packages/engine/`: `package.json`, `tsconfig.json`
- `packages/engine/src/`: `cards.ts`, `constants.ts`, `rng.ts`, `deck.ts`, `errors.ts`, `types.ts`, `meldRules.ts`, `pileRules.ts`, `turnRules.ts`, `play.ts`, `scoring.ts`, `clone.ts`, `round.ts`, `game.ts`, `actions.ts`, `view.ts`, `preview.ts`, `index.ts`
- `packages/engine/test/`: `fixtures.ts`, `cards.test.ts`, `constants.test.ts`, `rng.test.ts`, `deck.test.ts`, `meldRules.test.ts`, `pileRules.test.ts`, `turnRules.test.ts`, `play.test.ts`, `scoring.test.ts`, `game.test.ts`, `actions.test.ts`, `view.test.ts`, `preview.test.ts`, `simulation.test.ts`

## Failed Approaches

- **Task 1 initially skipped `format:check`.** The plan's code was not Prettier-formatted, so implementers now run `npm run format` and `format:check` before every commit.
- **The first README draft misstated three rules** (Black 3s, personal freeze, concealed bonus). It was corrected in `f619980`. Check any rules prose against spec Section 3.

## Files to Read

- `docs/superpowers/specs/2026-09-27-cutthroat-canasta-design.md`: the spec. Section 3 is the rules authority.
- `docs/superpowers/plans/2026-09-27-engine.md`: the engine plan (10 tasks, with full code).
- `.superpowers/sdd/2026-09-27-engine/progress.md`: the execution ledger with rulings and deferred minor findings. It's git-ignored and local only.
- `Cutthroat_Canasta_House_Rule_Sheet_V3.docx.pdf`: the original house rule sheet (provided in chat, not in the repo).

## Next Steps

1. All 10 tasks done. Final whole-branch review in progress.
2. Run a final whole-branch review on the most capable model, including the deferred minor findings in the ledger.
3. Finish the branch (merge or PR decision with the user).
4. Write Plan 2 (server) and Plan 3 (web client and rules page).

## Open Questions

- None blocking. The user approved the spec, including the [clarified] rules. Any rule change should update spec Section 3 first.
