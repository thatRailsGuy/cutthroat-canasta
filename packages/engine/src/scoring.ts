import type { Card } from './cards'
import {
  CONCEALED_HAND_BONUS,
  GOING_OUT_BONUS,
  MIXED_CANASTA_BONUS,
  NATURAL_CANASTA_BONUS,
  RED_THREE_BONUS,
  cardValue,
} from './constants'
import { isCanasta, isNaturalCanasta } from './meldRules'
import type { Player, ScoreBreakdown } from './types'

const sumValues = (list: Card[]) => list.reduce((sum, c) => sum + cardValue(c), 0)

export function scorePlayer(player: Player, wentOut: string | null): ScoreBreakdown {
  const meldPoints = player.melds.reduce((sum, m) => sum + sumValues(m.cards), 0)
  const canastaBonus = player.melds
    .filter(isCanasta)
    .reduce(
      (sum, m) => sum + (isNaturalCanasta(m) ? NATURAL_CANASTA_BONUS : MIXED_CANASTA_BONUS),
      0,
    )
  const red3Sign = player.melds.length > 0 ? 1 : -1
  const red3Points = red3Sign * player.red3s.length * RED_THREE_BONUS
  const isOut = wentOut === player.id
  const goingOutBonus = isOut ? GOING_OUT_BONUS : 0
  const concealedBonus = isOut && !player.meldedBeforeThisTurn ? CONCEALED_HAND_BONUS : 0
  const handPenalty = sumValues(player.hand)
  return {
    meldPoints,
    canastaBonus,
    red3Points,
    goingOutBonus,
    concealedBonus,
    handPenalty,
    total: meldPoints + canastaBonus + red3Points + goingOutBonus + concealedBonus - handPenalty,
  }
}

export function scoreRound(
  players: Player[],
  wentOut: string | null,
): Record<string, ScoreBreakdown> {
  return Object.fromEntries(players.map((p) => [p.id, scorePlayer(p, wentOut)]))
}
