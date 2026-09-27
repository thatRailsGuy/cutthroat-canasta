import type { Game } from './types'

/** Deep copy for immutable updates. Log entries are never mutated, so the log is copied shallowly. */
export function cloneGame(game: Game): Game {
  const { log, ...rest } = game
  return { ...(JSON.parse(JSON.stringify(rest)) as Omit<Game, 'log'>), log: [...log] }
}
