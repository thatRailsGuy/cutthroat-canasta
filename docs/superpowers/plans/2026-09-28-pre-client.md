# Pre-client Engine and Server Changes (Plan 2.5)

**Goal:** Settle the engine and protocol before Plan 3 (web client). This plan closes the four open questions from the Plan 2 final review. The user decided them on 2026-09-28:

1. **Seat lifecycle:** a lobby `leave`, a host `kick`, and a host-issued rejoin token (`reissue`) for a player who is not connected.
2. **Host absence:** any seated player can start the next round.
3. **Seed strength:** replace mulberry32 (32-bit seed) with sfc32 seeded by four crypto u32 values.
4. **Visibility:** reveal every hand at round end, and add a public per-round action feed.

**Spec:** Sections 4 and 5 were updated first (same branch). Section 3 (rules) is unchanged.

## Global Constraints

- The Plan 1 and Plan 2 constraints still apply: strict TypeScript, Prettier, `npm run format:check`, no new runtime dependencies, and commits with no attribution lines.
- Stored games from before this plan have a numeric seed. Nothing is deployed, so there is no migration. A stored room with the old shape is not supported.
- The engine keeps its conventions: rule violations return a `RuleError`, and programmer errors (for example an unknown player id in `removePlayer`) throw.

## Tasks

### Task 1: sfc32 and a 128-bit seed (engine)

- `rng.ts`: `type Seed = [number, number, number, number]`. `createRng(seed: Seed)` is sfc32. It discards its first 12 outputs, so that similar seeds diverge.
- `Game.seed: Seed`. `createGame(seed: Seed)`.
- `dealRound` derives each round's seed by mixing the round number into the first word (`seed[0] ^ Math.imul(number, 0x9e3779b9)`), so no two rounds share a shuffle.
- Tests: values in [0, 1), deterministic per seed, different for seeds that differ only in the last word, and different decks for different rounds of one game. Test helpers take a number and expand it to a `Seed`.

### Task 2: public action feed (engine)

- `Round.feed: FeedEvent[]`, reset by `dealRound`. `applyAction` appends the events listed in spec 4.1:
  - `drawStock`: `drewStock` with any Red 3s turned up, then `stockOut` if the stock ran out.
  - `pickUpPile`: `pickedUpPile` with the whole pile's size and the validated play.
  - `meld`: `melded` with the validated play.
  - `discard`: `discarded` with the card.
  - Going out appends `wentOut` after the event that emptied the hand.
- `RoundView.feed` exposes it.
- The simulation's leak check changes. The secret set becomes "cards that were never face up": the simulation records every card id that was ever the top discard, in a meld, or a Red 3. The view must never show a card outside that set, other than the viewer's own hand.

### Task 3: revealed hands and `removePlayer` (engine)

- `RoundScore.hands`: every player's hand when the round ended. This replaced an earlier `PublicPlayer.revealedHand`, which disappeared as soon as someone dealt the next round.
- `removePlayer(game, playerId)`: lobby only (`NOT_IN_LOBBY`). It throws for an unknown id.
- The simulation leak check runs only while the status is `playing`, and a new check confirms that every hand is revealed at round end.

### Task 4: protocol and room handler (server)

- Seeds: `randomSeed(): Seed` from four crypto u32 values. `createRoom(code, seed: Seed)`.
- New client messages: `leave`, `kick {playerId}`, `reissue {playerId}`.
- New server messages: `removed {reason: 'left' | 'kicked'}` and `reissued {playerId, token}`.
- New protocol error codes:
  - `NO_SUCH_PLAYER`: the kick or reissue target is not seated.
  - `PLAYER_CONNECTED`: the reissue target is connected.
- `handleMessage` takes the connected player ids, so that `reissue` can refuse a connected player. `Outcome.detach` names a player whose sockets must get `removed` and be unbound.
- `leave` and `kick`: call `removePlayer`, delete the player's tokens, and hand off the host role to the first remaining seat if needed.
- `reissue`: host only. Delete the target's tokens, add a new one, and reply `reissued` to the host only. Save, with no broadcast.
- `nextRound`: any seated player. Two players pressing it at once is harmless: the second gets `ROUND_NOT_OVER`.

### Task 5: GameRoom wiring, worker tests, docs

- `GameRoom` computes connected ids once per message and passes them to `handleMessage`. On `detach`, it sends `removed` to that player's sockets and resets their attachments to `playerId: null`.
- Worker tests:
  - leave in the lobby
  - kick by the host, where the kicked socket gets `removed` and can join again
  - reissue a disconnected seat, where the old token fails and the new one reattaches
  - reissue refused while the target is connected
  - a non-host starts the next round
- Update the README protocol tables and status.
