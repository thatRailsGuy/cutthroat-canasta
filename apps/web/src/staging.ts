import {
  legalityPreview,
  type Action,
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
  | { type: 'toggle'; cardId: CardId }
  | { type: 'stageNew' }
  | { type: 'stageAdd'; meldId: string }
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
      const selected = staging.selected.includes(action.cardId)
        ? staging.selected.filter((id) => id !== action.cardId)
        : [...staging.selected, action.cardId]
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

/** The staged groups, plus any selected cards as one more new meld. */
export function toBatch(staging: Staging): MeldBatch {
  const newMelds = staging.groups.filter((g) => g.meldId === null).map((g) => g.cardIds)
  if (staging.selected.length > 0) newMelds.push(staging.selected)
  const additions = staging.groups
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
  const batch = toBatch(staging)
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
