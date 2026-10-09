# To do

Playtest feedback and follow-ups that are not yet scheduled.

Make a mockup artifact for every visual change, and agree on it before anyone writes code.

## Web client

- [ ] Add a tutorial section on how our house rules differ from standard Canasta, for players who already know the game. The tutorial ([lesson.ts](../apps/web/src/tutorial/lesson.ts)) teaches the game from the start, and the rules page ([RulesContent.tsx](../apps/web/src/rules/RulesContent.tsx)) has a house-rules table. Open question: a separate short lesson, or a page that links each difference to its rules section?

## Server and project

- [ ] Add bots: computer players that take a seat and play their own turns. They would fill a table when there aren't enough people, and let `/dev` play a game forward instead of leaving its seats idle (today the [dev index](../apps/web/src/dev/DevIndexPage.tsx) only holds made-up seats online). A bot sees only its own `PlayerView` ([view.ts](../packages/engine/src/view.ts)), the same as a player, and sends ordinary actions, so the server checks its moves like anyone else's (`applyAction`, [actions.ts](../packages/engine/src/actions.ts); `legalityPreview`, [preview.ts](../packages/engine/src/preview.ts), can test a move before sending it). **Open questions:** where a bot runs (in the room's Durable Object, so it keeps playing with no tab open, or in a browser tab, which is enough for `/dev`); how well it plays (legal moves at random, or simple rules for drawing, picking up the pile, melding and discards); whether players can add one from the lobby, and how it shows at the table; and whether a bot can take over the seat of a player who quit or went away. Showing bots to players needs a mockup.
- [ ] Run the checks in GitHub Actions on every push and pull request: `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm test`. There is no CI today. **Accessibility:** `npm test` already runs the axe-core checks in jsdom ([axe.test.tsx](../apps/web/test/axe.test.tsx)), so the CI job covers them with no extra step. jsdom has no layout, so those tests turn off contrast and target size. To check those too, add a second job that builds the web client, serves it, and runs axe-core in headless Chromium against the home page, the lobby, `/dev/table` at desktop and phone widths, `/rules` and `/learn` (the 2026-10-08 audit did this with a CDP script and Playwright's cached Chromium). It needs a browser on the runner (for example `npx playwright install chromium`) and a seeded public table for the lobby. Contrast over the gingham comes back "needs review", not as a failure, so that job should fail only on violations, and list the rest.
