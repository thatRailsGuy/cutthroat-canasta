# Cutthroat Canasta

An online version of the house Cutthroat Canasta rules (V3) for 2–8 players playing individually. Players join a game from separate devices via a shared code and play to 5,000 points. Built as a TypeScript monorepo with a pure rules engine (zero runtime dependencies), a Cloudflare Workers server, and a React + Vite web client.

## House rules at a glance

- **1-card draw:** each turn, draw one card from stock or pick up the discard pile
- **Black 3s are stop cards:** they can never be melded; a Black 3 on top of the discard pile blocks the next player from picking it up
- **Wild ratio:** wilds (Jokers and 2s) cannot outnumber naturals in a meld (`wilds ≤ naturals`)
- **Personal pile freeze:** the discard pile is frozen for you until your first pickup each round. To take a frozen pile you need a natural pair matching the top card
- **Multiple melds per rank:** a player can start a new meld of the same rank they already have
- **Finished canasta cannot take the pile:** a completed 7+ card meld cannot accept the top discard card
- **Initial meld minimums by score:** 15 points (negative score), 50 (0–1,495), 90 (1,500–2,995), 120 (3,000+)
- **No going out first turn:** a player cannot end the round on their first turn of that round
- **Concealed hand bonus:** 200 points for going out on the same turn as your first meld of the round
- **Game to 5,000:** first player to reach 5,000 points wins

See [docs/superpowers/specs/2026-09-27-cutthroat-canasta-design.md](docs/superpowers/specs/2026-09-27-cutthroat-canasta-design.md) for the complete rules.

## Project layout

```text
packages/engine    TypeScript rules engine (in progress)
apps/server        Cloudflare Worker + Durable Object per game (planned)
apps/web           React + Vite client: lobby, table, rules page (planned)
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
```

## Status

The rules engine (`packages/engine`) is under construction. The server (`apps/server`) and web client (`apps/web`) are planned and not yet started.
