import type { Card } from './cards'
import {
  CONCEALED_HAND_BONUS,
  GOING_OUT_BONUS,
  DIRTY_CANASTA_BONUS,
  CLEAN_CANASTA_BONUS,
  RED_THREE_BONUS,
  cardValue,
} from './constants'
import { isCanasta, isNaturalCanasta } from './meldRules'
import type { Meld, Player, ScoreBreakdown } from './types'

const sumValues = (list: Card[]) => list.reduce((sum, c) => sum + cardValue(c), 0)

/** The part of a round score that is on the table: melds, canasta bonuses and Red 3s. */
export function tableScore({ melds, red3s }: { melds: Meld[]; red3s: Card[] }): {
  meldPoints: number
  canastaBonus: number
  red3Points: number
  total: number
} {
  const meldPoints = melds.reduce((sum, m) => sum + sumValues(m.cards), 0)
  const canastaBonus = melds
    .filter(isCanasta)
    .reduce((sum, m) => sum + (isNaturalCanasta(m) ? CLEAN_CANASTA_BONUS : DIRTY_CANASTA_BONUS), 0)
  // melds.length > 0 means the player made an initial meld this round; relies on
  // dealRound resetting melds at the start of each round.
  const red3Sign = melds.length > 0 ? 1 : -1
  const red3Points = red3Sign * red3s.length * RED_THREE_BONUS
  return { meldPoints, canastaBonus, red3Points, total: meldPoints + canastaBonus + red3Points }
}

export function scorePlayer(player: Player, wentOut: string | null): ScoreBreakdown {
  const { meldPoints, canastaBonus, red3Points } = tableScore(player)
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
