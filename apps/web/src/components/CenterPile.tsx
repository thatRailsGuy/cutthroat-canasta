import { isBlack3, isPileFrozenFor, isRed3, type CardId, type PlayerView } from '@canasta/engine'
import { cardLabel } from '../cards'
import { Card, CardBack } from './Card'
import styles from './CenterPile.module.css'
import { Snowflake } from './Snowflake'

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
  /** Cards the tutorial points at. */
  lit?: readonly CardId[]
}

export function CenterPile(props: CenterPileProps) {
  const { view, yourTurn, selected, staged, offline = false, onToggleTop, onDraw, lit = [] } = props
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
  // Cards under the top one peek out, face down to the eye, so the pile reads as a pile.
  const under = Math.min(Math.max(round.discardCount - 1, 0), 2)
  return (
    <section className={styles.center} aria-label="Stock and discard pile" data-focus-group="pile">
      <div className={styles.spot}>
        <button
          type="button"
          className={styles.stock}
          disabled={!canDraw || offline}
          onClick={onDraw}
          data-stock=""
        >
          <span className={styles.stack} aria-hidden="true">
            {round.stockCount > 2 && <CardBack />}
            {round.stockCount > 1 && <CardBack />}
            {round.stockCount > 0 ? <CardBack /> : <span className={styles.empty} />}
          </span>
          <span className={styles.label}>
            {round.stockCount > 0 ? (
              <>
                Draw a card <span className={styles.count}>({round.stockCount} left)</span>
              </>
            ) : (
              'Stock empty: end the round'
            )}
          </span>
        </button>
      </div>

      <div className={styles.spot}>
        <div
          className={`${styles.pile} ${frozen ? styles.frozen : ''}`}
          data-pile=""
          data-drop="pile"
        >
          {top ? (
            <span className={styles.pileStack}>
              {Array.from({ length: under }, (_, i) => (
                <span key={i} className={`${styles.under} ${styles[`under${i}`]}`} />
              ))}
              {/* The card that froze the pile lies sideways under it, sticking out so it shows. */}
              {frozenBy && frozenBy.id !== top.id && (
                <span className={styles.sideways}>
                  <Card card={frozenBy} />
                </span>
              )}
              <span
                className={frozenBy?.id === top.id ? styles.sidewaysTop : styles.topCard}
                data-sideways={frozenBy?.id === top.id ? '' : undefined}
              >
                <Card
                  card={top}
                  selected={selected.includes(top.id) || topStaged}
                  lit={lit.includes(top.id)}
                  onClick={canDraw && !topStaged ? () => onToggleTop(top.id) : undefined}
                />
                {isBlack3(top) && (
                  <span className={styles.stop} title="A black 3 on top: nobody can take the pile">
                    Stop
                    <span className="sr-only">: a black 3 on top, so nobody can take the pile</span>
                  </span>
                )}
              </span>
              {frozen && (
                <span className={styles.snowflake} aria-hidden="true">
                  <Snowflake />
                </span>
              )}
            </span>
          ) : (
            <span className={styles.empty}>Empty pile</span>
          )}
        </div>
        <span className={styles.label}>{round.discardCount} in pile</span>
        {topStaged && <span className={styles.stagedNote}>In the staging area</span>}
      </div>

      {top && frozen && frozenReason && (
        <p className={styles.bubble} title={`Frozen because ${frozenReason}`}>
          <strong>Frozen for you</strong>
          <span>{frozenReason}</span>
        </p>
      )}
    </section>
  )
}
