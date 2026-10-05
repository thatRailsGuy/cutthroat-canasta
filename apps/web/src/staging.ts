import {
  isCanasta,
  isNatural,
  isPileFrozenFor,
  isWild,
  legalityPreview,
  type Action,
  type Card,
  type CardId,
  type MeldBatch,
  type PlayerView,
  type RuleError,
} from '@canasta/engine'
import { useState } from 'react'

/** Cards staged as one new meld (`meldId: null`) or as an addition to one of your melds. */
export interface StagedGroup {
  meldId: string | null
  cardIds: CardId[]
}

export interface Staging {
  /** Selected but not yet staged. They also count as one more new meld in the batch. */
  selected: CardId[]
  groups: StagedGroup[]
}

export type StagingAction =
  /** `also`: more cards to select with it, only when this selects the card. */
  | { type: 'toggle'; cardId: CardId; also?: readonly CardId[] }
  | { type: 'stageNew' }
  | { type: 'stageAdd'; meldId: string }
  /**
   * Dragged cards dropped on a meld (`meldId`) or on the staging area (`null`): a new meld, or
   * the staged new meld at index `join`.
   */
  | { type: 'stageCards'; cardIds: readonly CardId[]; meldId: string | null; join?: number }
  | { type: 'unstage'; cardId: CardId }
  | { type: 'clear' }

export const emptyStaging: Staging = { selected: [], groups: [] }

/** What the player may stage right now: their hand, plus the top discard during the draw phase. */
export interface Available {
  cardIds: ReadonlySet<CardId>
  meldIds: ReadonlySet<string>
}

export function availableIn(view: PlayerView): Available {
  const you = view.you
  const round = view.round
  const cardIds = new Set<CardId>(you?.hand.map((c) => c.id) ?? [])
  if (round?.phase === 'draw' && round.discardTop) cardIds.add(round.discardTop.id)
  return { cardIds, meldIds: new Set(you?.melds.map((m) => m.id) ?? []) }
}

export function stagedIds(staging: Staging): Set<CardId> {
  return new Set(staging.groups.flatMap((g) => g.cardIds))
}

/** Drops cards and melds that are gone (played, discarded, or a new phase). */
export function reconcile(staging: Staging, available: Available): Staging {
  const keep = (id: CardId) => available.cardIds.has(id)
  const selected = staging.selected.filter(keep)
  const groups = staging.groups
    .filter((g) => g.meldId === null || available.meldIds.has(g.meldId))
    .map((g) => ({ ...g, cardIds: g.cardIds.filter(keep) }))
    .filter((g) => g.cardIds.length > 0)
  const unchanged =
    selected.length === staging.selected.length &&
    groups.length === staging.groups.length &&
    groups.every((g, i) => g.cardIds.length === staging.groups[i].cardIds.length)
  return unchanged ? staging : { selected, groups }
}

export function stagingReducer(staging: Staging, action: StagingAction): Staging {
  switch (action.type) {
    case 'toggle': {
      if (stagedIds(staging).has(action.cardId)) return staging
      const staged = stagedIds(staging)
      const also = (action.also ?? []).filter(
        (id) => id !== action.cardId && !staged.has(id) && !staging.selected.includes(id),
      )
      const selected = staging.selected.includes(action.cardId)
        ? staging.selected.filter((id) => id !== action.cardId)
        : [...staging.selected, action.cardId, ...also]
      return { ...staging, selected }
    }
    case 'stageNew':
      if (staging.selected.length === 0) return staging
      return {
        selected: [],
        groups: [...staging.groups, { meldId: null, cardIds: staging.selected }],
      }
    case 'stageAdd': {
      if (staging.selected.length === 0) return staging
      const existing = staging.groups.find((g) => g.meldId === action.meldId)
      const groups = existing
        ? staging.groups.map((g) =>
            g === existing ? { ...g, cardIds: [...g.cardIds, ...staging.selected] } : g,
          )
        : [...staging.groups, { meldId: action.meldId, cardIds: staging.selected }]
      return { selected: [], groups }
    }
    case 'stageCards': {
      const staged = stagedIds(staging)
      const cardIds = action.cardIds.filter((id) => !staged.has(id))
      if (cardIds.length === 0) return staging
      const selected = staging.selected.filter((id) => !cardIds.includes(id))
      const existing =
        action.meldId === null
          ? staging.groups[action.join ?? -1]
          : staging.groups.find((g) => g.meldId === action.meldId)
      const groups = existing
        ? staging.groups.map((g) =>
            g === existing ? { ...g, cardIds: [...g.cardIds, ...cardIds] } : g,
          )
        : [...staging.groups, { meldId: action.meldId, cardIds }]
      return { selected, groups }
    }
    case 'unstage': {
      const groups = staging.groups
        .map((g) => ({ ...g, cardIds: g.cardIds.filter((id) => id !== action.cardId) }))
        .filter((g) => g.cardIds.length > 0)
      return { ...staging, groups }
    }
    case 'clear':
      return emptyStaging
  }
}

/**
 * Where the selected cards go by default: your unfinished meld of their rank, if you have one.
 * You may start another meld of a rank only once your meld of it is a canasta, so selected
 * cards of that rank join it. Null means they make a new meld.
 */
export function selectionTarget(view: PlayerView, selected: readonly CardId[]): string | null {
  const you = view.you
  if (!you || selected.length === 0) return null
  const top = view.round?.discardTop
  const byId = new Map<CardId, Card>([...you.hand, ...(top ? [top] : [])].map((c) => [c.id, c]))
  const ranks = new Set(
    selected.flatMap((id) => {
      const card = byId.get(id)
      return card && isNatural(card) ? [card.rank] : []
    }),
  )
  if (ranks.size !== 1) return null
  const [rank] = ranks
  return you.melds.find((m) => m.rank === rank && !isCanasta(m))?.id ?? null
}

/**
 * Cards from your hand to select along with the top discard, so picking it up takes one click:
 * - Not frozen, with an unfinished meld of its rank: none. The top card joins that meld.
 * - Not frozen otherwise: a natural pair of its rank, or one natural and one wild.
 * - Frozen: a natural pair of its rank, if you hold one. They start a meld with the top card,
 *   or join your unfinished meld of that rank.
 * Cards already selected or staged count toward the pair.
 */
export function pickupHelpers(view: PlayerView, staging: Staging): CardId[] {
  const you = view.you
  const round = view.round
  const top = round?.discardTop
  if (!you || !round || !top || round.phase !== 'draw' || !isNatural(top)) return []
  const frozen = isPileFrozenFor(you, { top, pileFrozenForAll: round.pileFrozenForAll })
  const hasOpenMeld = you.melds.some((m) => m.rank === top.rank && !isCanasta(m))
  if (!frozen && hasOpenMeld) return []

  const taken = new Set([...staging.selected, ...stagedIds(staging)])
  const jokersFirst = (a: Card, b: Card) =>
    (a.rank === 'JOKER' ? 0 : 1) - (b.rank === 'JOKER' ? 0 : 1)
  const naturals = you.hand.filter((c) => isNatural(c) && c.rank === top.rank)
  const chosen = naturals.filter((c) => taken.has(c.id)).length
  const free = naturals.filter((c) => !taken.has(c.id)).map((c) => c.id)
  const pair = free.slice(0, Math.max(0, 2 - chosen))
  if (chosen + pair.length >= 2) return pair
  if (frozen) return []
  // One natural: make up the pair with a wild, a Joker before a 2, unless one is chosen already.
  if (you.hand.some((c) => isWild(c) && taken.has(c.id))) return pair
  const wild = you.hand.filter((c) => isWild(c) && !taken.has(c.id)).sort(jokersFirst)[0]
  return chosen + pair.length === 1 && wild ? [...pair, wild.id] : []
}

/**
 * The staged groups, plus any selected cards: as an addition to `target`, or as one more new
 * meld when `target` is null.
 */
export function toBatch(staging: Staging, target: string | null = null): MeldBatch {
  const all =
    target === null ? staging : stagingReducer(staging, { type: 'stageAdd', meldId: target })
  const newMelds = all.groups.filter((g) => g.meldId === null).map((g) => g.cardIds)
  if (all.selected.length > 0) newMelds.push(all.selected)
  const additions = all.groups
    .filter((g): g is StagedGroup & { meldId: string } => g.meldId !== null)
    .map((g) => ({ meldId: g.meldId, cardIds: g.cardIds }))
  return { newMelds, additions }
}

export type StagingPreview =
  | { kind: 'none' }
  | { kind: 'meld' | 'pickUpPile' | 'discard'; action: Action; error: RuleError | null }

/**
 * The action the staged cards describe, checked with the engine's `legalityPreview`:
 * - draw phase: picking up the pile with the batch (it must include the top discard)
 * - play phase, one selected card and nothing staged: discarding it
 * - play phase otherwise: melding the batch
 */
export function stagingPreview(view: PlayerView, staging: Staging): StagingPreview {
  const round = view.round
  if (!view.you || !round || view.status !== 'playing') return { kind: 'none' }
  const batch = toBatch(staging, selectionTarget(view, staging.selected))
  const empty = batch.newMelds.length === 0 && batch.additions.length === 0
  let action: Action
  if (round.phase === 'draw') {
    if (empty) return { kind: 'none' }
    action = { type: 'pickUpPile', play: batch }
  } else if (staging.groups.length === 0 && staging.selected.length === 1) {
    action = { type: 'discard', cardId: staging.selected[0] }
  } else {
    if (empty) return { kind: 'none' }
    action = { type: 'meld', play: batch }
  }
  return {
    kind: action.type as 'meld' | 'pickUpPile' | 'discard',
    action,
    error: legalityPreview(view, action),
  }
}

/**
 * One selected card, with nothing staged, that can also join your unfinished meld of its rank:
 * the play that adds it there. `stagingPreview` reads that selection as a discard, so this is
 * the other choice. Null when the selection isn't one such card.
 */
export function singleAddition(
  view: PlayerView,
  staging: Staging,
): { action: Action; error: RuleError | null } | null {
  if (view.status !== 'playing' || view.round?.phase !== 'play') return null
  if (staging.groups.length > 0 || staging.selected.length !== 1) return null
  const target = selectionTarget(view, staging.selected)
  if (target === null) return null
  const action: Action = { type: 'meld', play: toBatch(staging, target) }
  return { action, error: legalityPreview(view, action) }
}

/**
 * Staging state that stays in step with the view: cards that left your hand drop out. When the
 * view prunes something, the stored state is pruned too (a guarded update during render), so a
 * card that comes back later, such as the same top discard in a later draw phase, doesn't
 * reappear in its old group.
 */
export function useStaging(view: PlayerView): [Staging, (action: StagingAction) => void] {
  const [raw, setRaw] = useState(emptyStaging)
  const available = availableIn(view)
  const staging = reconcile(raw, available)
  if (staging !== raw) setRaw(staging)
  const dispatch = (action: StagingAction) =>
    setRaw((current) => stagingReducer(reconcile(current, available), action))
  return [staging, dispatch]
}
