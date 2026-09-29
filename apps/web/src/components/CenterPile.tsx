import { isPileFrozenFor, type CardId, type PlayerView } from '@canasta/engine'
import { Card } from './Card'
import styles from './Table.module.css'

export interface CenterPileProps {
  view: PlayerView
  yourTurn: boolean
  selected: readonly CardId[]
  onToggleTop: (cardId: CardId) => void
  onDraw: () => void
}

export function CenterPile({ view, yourTurn, selected, onToggleTop, onDraw }: CenterPileProps) {
  const round = view.round!
  const top = round.discardTop
  const canDraw = yourTurn && round.phase === 'draw'
  const frozenReason = view.you
    ? round.pileFrozenForAll
      ? 'a wild is in the pile'
      : !view.you.hasPickedUpPile
        ? "you haven't picked it up this round"
        : null
    : null
  const frozen =
    view.you !== null &&
    isPileFrozenFor(view.you, { top, pileFrozenForAll: round.pileFrozenForAll })
  return (
    <section className={styles.center} aria-label="Stock and discard pile">
      <button type="button" className={styles.stock} disabled={!canDraw} onClick={onDraw}>
        {round.stockCount > 0 ? `Draw (${round.stockCount} left)` : 'Stock empty: end the round'}
      </button>
      <div className={styles.pile}>
        {top ? (
          <Card
            card={top}
            selected={selected.includes(top.id)}
            onClick={canDraw ? () => onToggleTop(top.id) : undefined}
          />
        ) : (
          <span className={styles.empty}>Empty pile</span>
        )}
        <span>{round.discardCount} in pile</span>
        {frozen && frozenReason && (
          <span className={styles.frozen} title={`Frozen because ${frozenReason}`}>
            Frozen for you: {frozenReason}
          </span>
        )}
      </div>
    </section>
  )
}
