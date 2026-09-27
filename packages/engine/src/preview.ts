import { ruleError, type RuleError } from './errors'
import { validatePlay } from './play'
import { checkDiscard, checkPhase, checkTurn } from './turnRules'
import type { Action } from './types'
import type { PlayerView } from './view'

/** Client-side check using only what the acting player can see. The server remains authoritative. */
export function legalityPreview(view: PlayerView, action: Action): RuleError | null {
  const { you, round } = view
  if (!you || !round) return ruleError('GAME_NOT_PLAYING', 'The game is not in progress.')
  const error =
    checkTurn(view.status, view.players[round.current]?.id, you.id) ??
    checkPhase(round.phase, action.type)
  if (error) return error

  switch (action.type) {
    case 'drawStock':
      return null
    case 'discard':
      return checkDiscard(you, action.cardId)
    case 'meld':
    case 'pickUpPile': {
      const result = validatePlay(
        {
          player: you,
          pile: { top: round.discardTop, pileFrozenForAll: round.pileFrozenForAll },
          pileSize: round.discardCount,
          takesPile: action.type === 'pickUpPile',
        },
        action.play,
      )
      return result.ok ? null : result.error
    }
    default: {
      const exhaustive: never = action
      throw new Error(`Unknown action type: ${(exhaustive as { type?: unknown }).type}`)
    }
  }
}
