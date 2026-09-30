import { isPileFrozenFor, isRed3, type CardId, type PlayerView } from '@canasta/engine'
import { cardLabel } from '../cards'
import { Card } from './Card'
import styles from './Table.module.css'

export interface CenterPileProps {
  view: PlayerView
  yourTurn: boolean
  selected: readonly CardId[]
  /** Cards in the staging area. A staged top discard is marked in the pile. */
  staged: ReadonlySet<CardId>
  /** The socket isn't open, so drawing is disabled. */
  offline?: boolean
  onToggleTop: (cardId: CardId) => void
  onDraw: () => void
}

export function CenterPile(props: CenterPileProps) {
  const { view, yourTurn, selected, staged, offline = false, onToggleTop, onDraw } = props
  const round = view.round!
  const top = round.discardTop
  const canDraw = yourTurn && round.phase === 'draw'
  const topStaged = top !== null && staged.has(top.id)
  // `?? null`: a view from a server that predates `frozenBy`.
  const frozenBy = round.frozenBy ?? null
  const frozenReason = view.you
    ? round.pileFrozenForAll
      ? frozenBy
        ? `the ${cardLabel(frozenBy)} ${isRed3(frozenBy) ? 'started' : 'is in'} the pile`
        : 'a wild is in the pile'
      : !view.you.hasPickedUpPile
        ? "you haven't picked it up this round"
        : null
    : null
  const frozen =
    view.you !== null &&
    isPileFrozenFor(view.you, { top, pileFrozenForAll: round.pileFrozenForAll })
  return (
    <section className={styles.center} aria-label="Stock and discard pile">
      <button
        type="button"
        className={styles.stock}
        disabled={!canDraw || offline}
        onClick={onDraw}
      >
        {round.stockCount > 0 ? `Draw (${round.stockCount} left)` : 'Stock empty: end the round'}
      </button>
      <div className={styles.pile}>
        {top ? (
          <>
            {/* The card that froze the pile lies sideways under it, sticking out so it shows. */}
            <span className={styles.pileStack}>
              {frozenBy && frozenBy.id !== top.id && (
                <span className={styles.sideways}>
                  <Card card={frozenBy} />
                </span>
              )}
              <span className={frozenBy?.id === top.id ? styles.sidewaysTop : styles.topCard}>
                <Card
                  card={top}
                  selected={selected.includes(top.id) || topStaged}
                  onClick={canDraw && !topStaged ? () => onToggleTop(top.id) : undefined}
                />
              </span>
            </span>
            {topStaged && <span className={styles.stagedNote}>In the staging area</span>}
          </>
        ) : (
          <span className={styles.empty}>Empty pile</span>
        )}
        <span>{round.discardCount} in pile</span>
        {top && frozen && frozenReason && (
          <span className={styles.frozen} title={`Frozen because ${frozenReason}`}>
            Frozen for you: {frozenReason}
          </span>
        )}
      </div>
    </section>
  )
}
