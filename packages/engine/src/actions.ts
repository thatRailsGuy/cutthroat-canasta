import { isRed3, isWild, type Card, type CardId } from './cards'
import { cloneGame } from './clone'
import type { RuleError } from './errors'
import { pileStateOf } from './pileRules'
import { applyPlay, validatePlay, type ValidatedPlay } from './play'
import { advanceTurn, endRound } from './round'
import { checkDiscard, checkPhase, checkTurn } from './turnRules'
import type { Action, Game, GameResult, MeldBatch, Played, Player, Round } from './types'

export function applyAction(game: Game, playerId: string, action: Action): GameResult {
  const currentId = game.round ? game.players[game.round.current]?.id : undefined
  const turnError = checkTurn(game.status, currentId, playerId)
  if (turnError) return { ok: false, error: turnError }

  const next = cloneGame(game)
  const round = next.round!
  const player = next.players[round.current]
  const error = checkPhase(round.phase, action.type) ?? perform(next, round, player, action)
  if (error) return { ok: false, error }

  next.log.push({ playerId, action })
  return { ok: true, game: next }
}

function perform(game: Game, round: Round, player: Player, action: Action): RuleError | null {
  switch (action.type) {
    case 'drawStock':
      return drawStock(game, round, player)
    case 'pickUpPile':
      return pickUpPile(game, round, player, action.play)
    case 'meld':
      return meld(game, round, player, action.play)
    case 'discard':
      return discard(game, round, player, action.cardId)
    default: {
      const exhaustive: never = action
      throw new Error(`Unknown action type: ${(exhaustive as { type?: unknown }).type}`)
    }
  }
}

function drawStock(game: Game, round: Round, player: Player): null {
  const red3s: Card[] = []
  let card = round.stock.pop()
  while (card && isRed3(card)) {
    red3s.push(card)
    card = round.stock.pop()
  }
  player.red3s.push(...red3s)
  round.feed.push({ type: 'drewStock', playerId: player.id, red3s })
  if (!card) {
    round.feed.push({ type: 'stockOut' })
    endRound(game, null)
    return null
  }
  player.hand.push(card)
  round.phase = 'play'
  return null
}

function pickUpPile(game: Game, round: Round, player: Player, batch: MeldBatch): RuleError | null {
  const result = validatePlay(
    { player, pile: pileStateOf(round), pileSize: round.discard.length, takesPile: true },
    batch,
  )
  if (!result.ok) return result.error
  const rest = round.discard.slice(0, -1)
  round.feed.push({
    type: 'pickedUpPile',
    playerId: player.id,
    count: round.discard.length,
    played: played(result.play),
  })
  round.discard = []
  applyPlay(round, player, result.play)
  player.hand.push(...rest)
  player.hasPickedUpPile = true
  round.pileFrozenForAll = false
  round.phase = 'play'
  if (result.play.goesOut) goOut(game, round, player)
  return null
}

function meld(game: Game, round: Round, player: Player, batch: MeldBatch): RuleError | null {
  const result = validatePlay(
    { player, pile: pileStateOf(round), pileSize: round.discard.length, takesPile: false },
    batch,
  )
  if (!result.ok) return result.error
  round.feed.push({ type: 'melded', playerId: player.id, played: played(result.play) })
  applyPlay(round, player, result.play)
  if (result.play.goesOut) goOut(game, round, player)
  return null
}

function discard(game: Game, round: Round, player: Player, cardId: CardId): RuleError | null {
  const error = checkDiscard(player, cardId)
  if (error) return error
  const [card] = player.hand.splice(
    player.hand.findIndex((c) => c.id === cardId),
    1,
  )
  round.discard.push(card)
  round.feed.push({ type: 'discarded', playerId: player.id, card })
  if (isWild(card)) round.pileFrozenForAll = true
  if (player.hand.length === 0) goOut(game, round, player)
  else advanceTurn(game)
  return null
}

function goOut(game: Game, round: Round, player: Player): void {
  round.feed.push({ type: 'wentOut', playerId: player.id })
  endRound(game, player.id)
}

/** Copies the cards, so later additions to a meld never rewrite the feed. */
function played(play: ValidatedPlay): Played {
  return {
    newMelds: play.newMelds.map((cards) => [...cards]),
    additions: play.additions.map((a) => ({ meldId: a.meldId, cards: [...a.cards] })),
  }
}
