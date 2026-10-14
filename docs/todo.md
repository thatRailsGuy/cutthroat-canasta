# To do

Playtest feedback and follow-ups that are not yet scheduled.

Make a mockup artifact for every visual change, and agree on it before anyone writes code.

## Web client

- [ ] Add a tutorial section on how our house rules differ from standard Canasta, for players who already know the game. The tutorial ([lesson.ts](../apps/web/src/tutorial/lesson.ts)) teaches the game from the start, and the rules page ([RulesContent.tsx](../apps/web/src/rules/RulesContent.tsx)) has a house-rules table. Open question: a separate short lesson, or a page that links each difference to its rules section?
- [ ] Show toasts while the rules drawer is open. The drawer is a modal `<dialog>` in the top layer ([RulesDrawer.tsx](../apps/web/src/components/RulesDrawer.tsx)), so rule-error and "Not connected" toasts sit behind it until it closes ([Toasts.tsx](../apps/web/src/components/Toasts.tsx)). Needs a mockup if the toasts move.
- [ ] Show a QR code for a rejoin link once it's made. In the host drawer ([HostDrawer.tsx](../apps/web/src/components/HostDrawer.tsx)) a rejoin link is only a text box with **Copy**, and the only QR code is the invite link's, so it's easy to send someone the invite link when they need their seat back. The invite link opens the join form, and joining there takes a new seat. Label the rejoin link as opening that player's seat and hand. Needs a mockup.
- [ ] Say on the join form when a seat is waiting for its player. A game link without a token shows only the join form ([GamePage.tsx](../apps/web/src/pages/GamePage.tsx)), even mid-game with a seat away, so a player whose rejoin link went astray sits down as a new player. The form could say "Ann's seat is waiting for a rejoin link. Ask the host for it." A socket gets no state before it joins, so the server would need to send the away seats. Needs a mockup.

## Server and project

- [ ] Send only the new feed events. Every broadcast resends the whole round's feed, so the data sent grows with the square of the round length. Watch it; if it matters, only [gameState.ts](../apps/web/src/gameState.ts) on the client would need to change.
- [ ] Add bots: computer players that take a seat and play their own turns. They would fill a table when there aren't enough people, and let `/dev` play a game forward instead of leaving its seats idle (today the [dev index](../apps/web/src/dev/DevIndexPage.tsx) only holds made-up seats online). A bot sees only its own `PlayerView` ([view.ts](../packages/engine/src/view.ts)), the same as a player, and sends ordinary actions, so the server checks its moves like anyone else's (`applyAction`, [actions.ts](../packages/engine/src/actions.ts); `legalityPreview`, [preview.ts](../packages/engine/src/preview.ts), can test a move before sending it). **Open questions:** where a bot runs (in the room's Durable Object, so it keeps playing with no tab open, or in a browser tab, which is enough for `/dev`); how well it plays (legal moves at random, or simple rules for drawing, picking up the pile, melding and discards); whether players can add one from the lobby, and how it shows at the table; and whether a bot can take over the seat of a player who quit or went away. Showing bots to players needs a mockup.
