import type { CardId } from './cards'
import { ruleError, type RuleError } from './errors'
import { isCanasta } from './meldRules'
import type { Action, GameStatus, Phase, Player } from './types'

export function checkTurn(
  status: GameStatus,
  currentPlayerId: string | undefined,
  playerId: string,
): RuleError | null {
  if (status !== 'playing') return ruleError('GAME_NOT_PLAYING', 'The game is not in progress.')
  if (currentPlayerId !== playerId) return ruleError('NOT_YOUR_TURN', "It's not your turn.")
  return null
}

export function checkPhase(phase: Phase, actionType: Action['type']): RuleError | null {
  const needs: Phase = actionType === 'drawStock' || actionType === 'pickUpPile' ? 'draw' : 'play'
  if (phase === needs) return null
  return needs === 'draw'
    ? ruleError('WRONG_PHASE', "You've already drawn this turn.")
    : ruleError('WRONG_PHASE', 'Draw a card or pick up the pile first.')
}

export function hasCanasta(player: Player): boolean {
  return player.melds.some(isCanasta)
}

export function goingOutBlocker(player: Player, hasCanastaNow: boolean): RuleError | null {
  if (player.turnsThisRound < 2) {
    return ruleError(
      'CANNOT_GO_OUT_FIRST_TURN',
      "You can't go out on your first turn of the round.",
    )
  }
  if (!hasCanastaNow) {
    return ruleError('GOING_OUT_NEEDS_CANASTA', 'You need at least one canasta to go out.')
  }
  return null
}

export function checkDiscard(player: Player, cardId: CardId): RuleError | null {
  if (!player.hand.some((c) => c.id === cardId)) {
    return ruleError('CARD_NOT_IN_HAND', "That card isn't in your hand.")
  }
  if (player.hand.length === 1) return goingOutBlocker(player, hasCanasta(player))
  return null
}
