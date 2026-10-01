import { RULE_ERROR_SECTIONS, type Action, type PlayerView } from '@canasta/engine'
import { rankPlural } from '../cards'
import {
  selectionTarget,
  singleAddition,
  stagingPreview,
  type Staging,
  type StagingAction,
} from '../staging'
import { Card } from './Card'
import { WhyLink } from './WhyLink'
import styles from './StagingArea.module.css'

export interface StagingAreaProps {
  view: PlayerView
  staging: Staging
  /** The socket isn't open: actions can't be sent, so their buttons are disabled. */
  offline?: boolean
  dispatch: (action: StagingAction) => void
  /** Returns false if the action was not sent; the staging then stays for a retry. */
  onAction: (action: Action) => boolean
}

export function StagingArea({
  view,
  staging,
  offline = false,
  dispatch,
  onAction,
}: StagingAreaProps) {
  const preview = stagingPreview(view, staging)
  const you = view.you
  const top = view.round?.discardTop
  const cardById = new Map([...(you?.hand ?? []), ...(top ? [top] : [])].map((c) => [c.id, c]))
  const meldName = (meldId: string) => {
    const meld = you?.melds.find((m) => m.id === meldId)
    return meld ? `Add to your ${rankPlural(meld.rank)}` : 'Add to meld'
  }
  const targetRank = (meldId: string) => {
    const meld = you?.melds.find((m) => m.id === meldId)
    return meld ? rankPlural(meld.rank) : 'meld'
  }
  const ready = (kind: 'meld' | 'pickUpPile' | 'discard') =>
    !offline && preview.kind === kind && preview.error === null
  const run = () => {
    if (preview.kind === 'none') return
    if (onAction(preview.action)) dispatch({ type: 'clear' })
  }
  // One card that fits your meld of its rank: Meld adds it there, and Discard still discards it.
  const addition = singleAddition(view, staging)
  const canAdd = !offline && addition !== null && addition.error === null
  const add = () => {
    if (addition && onAction(addition.action)) dispatch({ type: 'clear' })
  }
  const nothingStaged = staging.selected.length === 0 && staging.groups.length === 0
  // Selected cards of a rank you have an unfinished meld of go onto it; no new meld is allowed.
  const target = selectionTarget(view, staging.selected)

  return (
    <section className={styles.staging} aria-label="Staging area">
      <div className={styles.groups}>
        {staging.groups.map((group, i) => (
          <div key={i} className={styles.group}>
            <span className={styles.groupLabel}>
              {group.meldId === null ? 'New meld' : meldName(group.meldId)}
            </span>
            {group.cardIds.map((id) => {
              const card = cardById.get(id)
              return card ? (
                <Card
                  key={id}
                  card={card}
                  size="small"
                  onClick={() => dispatch({ type: 'unstage', cardId: id })}
                />
              ) : null
            })}
          </div>
        ))}
      </div>

      {target !== null && (
        <p className={styles.target}>
          The selected cards go onto your {targetRank(target)}. You can start another meld of that
          rank once this one is a canasta.
        </p>
      )}

      <p className={styles.preview} role="status">
        {preview.kind === 'none' ? (
          'Select cards from your hand.'
        ) : preview.error ? (
          <>
            <span className={styles.illegal}>{preview.error.message}</span>{' '}
            <WhyLink section={RULE_ERROR_SECTIONS[preview.error.code]} />
          </>
        ) : (
          <span className={styles.legal}>
            {canAdd && target !== null && preview.kind === 'discard'
              ? `You can add this card to your ${targetRank(target)} or discard it.`
              : legalText(preview.kind)}
          </span>
        )}
      </p>

      <div className={styles.buttons}>
        <button
          type="button"
          disabled={staging.selected.length === 0 || target !== null}
          onClick={() => dispatch({ type: 'stageNew' })}
        >
          New meld
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={!ready('meld') && !canAdd}
          onClick={canAdd ? add : run}
        >
          Meld
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={!ready('pickUpPile')}
          onClick={run}
        >
          Pick up pile
        </button>
        <button type="button" className={styles.primary} disabled={!ready('discard')} onClick={run}>
          Discard
        </button>
        <button type="button" disabled={nothingStaged} onClick={() => dispatch({ type: 'clear' })}>
          Clear
        </button>
      </div>
    </section>
  )
}

function legalText(kind: 'meld' | 'pickUpPile' | 'discard'): string {
  if (kind === 'meld') return 'Legal meld.'
  if (kind === 'pickUpPile') return 'You can pick up the pile with this play.'
  return 'You can discard this card.'
}
