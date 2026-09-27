/** Anchors on the rules page. Plan 3 links each error toast to its section. */
export type RuleSection =
  | 'setup'
  | 'card-values'
  | 'turn'
  | 'melds'
  | 'initial-meld'
  | 'pickup'
  | 'going-out'
  | 'scoring'
  | 'winning'

export const RULE_ERROR_SECTIONS = {
  GAME_NOT_PLAYING: 'turn',
  NOT_YOUR_TURN: 'turn',
  WRONG_PHASE: 'turn',
  CARD_NOT_IN_HAND: 'turn',
  DUPLICATE_CARD: 'melds',
  EMPTY_PLAY: 'melds',
  MELD_NOT_FOUND: 'melds',
  MELD_TOO_SMALL: 'melds',
  MELD_MIXED_RANKS: 'melds',
  MELD_NEEDS_TWO_NATURALS: 'melds',
  WILDS_EXCEED_NATURALS: 'melds',
  THREES_NOT_MELDABLE: 'melds',
  INITIAL_MELD_TOO_LOW: 'initial-meld',
  PILE_EMPTY: 'pickup',
  PILE_BLOCKED: 'pickup',
  PICKUP_TOP_CARD_NOT_PLACED: 'pickup',
  FROZEN_NEEDS_NATURAL_PAIR: 'pickup',
  CANASTA_CANNOT_TAKE_PILE: 'pickup',
  CANNOT_GO_OUT_FIRST_TURN: 'going-out',
  GOING_OUT_NEEDS_CANASTA: 'going-out',
  MUST_KEEP_CARD_TO_DISCARD: 'going-out',
  NOT_IN_LOBBY: 'setup',
  TABLE_FULL: 'setup',
  NAME_TAKEN: 'setup',
  NOT_ENOUGH_PLAYERS: 'setup',
  ROUND_NOT_OVER: 'scoring',
} as const satisfies Record<string, RuleSection>

export type RuleErrorCode = keyof typeof RULE_ERROR_SECTIONS

export interface RuleError {
  code: RuleErrorCode
  message: string
}

export function ruleError(code: RuleErrorCode, message: string): RuleError {
  return { code, message }
}
