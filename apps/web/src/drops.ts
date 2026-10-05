import { isWild, legalityPreview, type CardId, type PlayerView } from '@canasta/engine'
import { rankPlural } from './cards'
import { selectionTarget, type Staging } from './staging'

/** Where dragged cards can land, read from a `data-drop` attribute. */
export type DropTarget =
  { kind: 'hand' } | { kind: 'new' } | { kind: 'pile' } | { kind: 'meld'; meldId: string }

export function parseDropTarget(value: string | undefined): DropTarget | null {
  if (value === 'hand' || value === 'new' || value === 'pile') return { kind: value }
  if (value?.startsWith('meld:')) return { kind: 'meld', meldId: value.slice(5) }
  return null
}

export type DropVerdict = { ok: true } | { ok: false; why: string }

/**
 * What dropping these cards on the target would do: allowed, refused with the reason, or null
 * when the target doesn't take cards right now (it doesn't light up). Playing needs your turn,
 * after the draw; moving one card around your hand works any time.
 */
export function dropVerdict(
  view: PlayerView,
  staging: Staging,
  target: DropTarget,
  cardIds: readonly CardId[],
): DropVerdict | null {
  const you = view.you
  if (!you) return null
  if (target.kind === 'hand') return cardIds.length === 1 ? { ok: true } : null
  const round = view.round
  const yourTurn =
    view.status === 'playing' && round !== null && view.players[round.current]?.id === you.id
  if (!yourTurn || round.phase !== 'play') return null

  if (target.kind === 'pile') {
    if (cardIds.length !== 1) return { ok: false, why: 'Discard one card at a time.' }
    if (staging.groups.length > 0) {
      return { ok: false, why: 'Meld or clear your staged cards first.' }
    }
    const error = legalityPreview(view, { type: 'discard', cardId: cardIds[0] })
    return error ? { ok: false, why: error.message } : { ok: true }
  }

  if (target.kind === 'meld') {
    const staged = staging.groups.find((g) => g.meldId === target.meldId)?.cardIds ?? []
    const error = legalityPreview(view, {
      type: 'meld',
      play: {
        newMelds: [],
        additions: [{ meldId: target.meldId, cardIds: [...staged, ...cardIds] }],
      },
    })
    return error ? { ok: false, why: error.message } : { ok: true }
  }

  // A new meld: one rank of naturals plus wilds. Its size is checked once you press Meld.
  const onto = selectionTarget(view, cardIds)
  if (onto !== null) {
    const meld = you.melds.find((m) => m.id === onto)!
    return {
      ok: false,
      why: `These go onto your ${rankPlural(meld.rank)}. Drop them there.`,
    }
  }
  const others = you.hand.filter((c) => cardIds.includes(c.id) && !isWild(c))
  if (others.some((c) => c.rank === '3')) return { ok: false, why: '3s can never be melded.' }
  if (new Set(others.map((c) => c.rank)).size > 1) {
    return { ok: false, why: 'A meld is cards of one rank, plus wilds.' }
  }
  return { ok: true }
}

/**
 * The staged new meld that cards dropped on the staging area join: the one of the same rank,
 * if there is one. Undefined starts another new meld.
 */
export function joinsStagedMeld(
  view: PlayerView,
  staging: Staging,
  cardIds: readonly CardId[],
): number | undefined {
  const hand = view.you?.hand ?? []
  const rankOf = (ids: readonly CardId[]) => {
    const ranks = new Set(hand.filter((c) => ids.includes(c.id) && !isWild(c)).map((c) => c.rank))
    return ranks.size === 1 ? [...ranks][0] : null
  }
  const rank = rankOf(cardIds)
  if (rank === null) return undefined
  const index = staging.groups.findIndex((g) => g.meldId === null && rankOf(g.cardIds) === rank)
  return index === -1 ? undefined : index
}
