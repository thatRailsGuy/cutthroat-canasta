import type { Card as CardValue } from '@canasta/engine'
import {
  buildMeld,
  buildPickup,
  buildScoringPlayers,
  type MeldExample,
  type PickupExample,
  type RulesExample,
  type ScoringExample,
} from '@canasta/engine/examples'
import { BreakdownTable } from '../components/BreakdownTable'
import { CardRow } from '../components/Card'
import styles from './Rules.module.css'

export function RuleExample({ example }: { example: RulesExample }) {
  return (
    <figure className={styles.example} id={`example-${example.id}`}>
      <figcaption>
        <strong>{example.title}</strong>
        {example.kind !== 'scoring' && <Verdict legal={example.expected === null} />}
      </figcaption>
      {example.kind === 'meld' && <MeldBody example={example} />}
      {example.kind === 'pickup' && <PickupBody example={example} />}
      {example.kind === 'scoring' && <ScoringBody example={example} />}
      <p>{example.caption}</p>
    </figure>
  )
}

function Verdict({ legal }: { legal: boolean }) {
  return (
    <span className={legal ? styles.legal : styles.illegal}>{legal ? 'Legal' : 'Not allowed'}</span>
  )
}

function Labeled({ label, cards }: { label: string; cards: CardValue[] }) {
  return (
    <div className={styles.labeled}>
      <span>{label}</span>
      <CardRow cards={cards} />
    </div>
  )
}

function MeldBody({ example }: { example: MeldExample }) {
  const { before, added } = buildMeld(example)
  return (
    <>
      {before.length > 0 && <Labeled label="Your meld" cards={before} />}
      <Labeled label={before.length > 0 ? 'Add' : 'Meld'} cards={added} />
      {example.canasta && <p className={styles.note}>Result: a {example.canasta} canasta.</p>}
    </>
  )
}

function PickupBody({ example }: { example: PickupExample }) {
  const { top, player } = buildPickup(example)
  const frozen = !example.hasPickedUpPile || example.wildInPile
  const reason = !example.hasPickedUpPile
    ? 'you have not picked it up yet this round'
    : example.wildInPile
      ? 'a wild is in the pile'
      : ''
  return (
    <>
      <Labeled label="Top of the pile" cards={[top]} />
      {player.hand.length > 0 && <Labeled label="From your hand" cards={player.hand} />}
      {player.melds.map((m, i) => (
        <Labeled
          key={m.id}
          label={example.target === i ? 'Onto your meld' : 'Your meld'}
          cards={m.cards}
        />
      ))}
      <p className={styles.note}>{frozen ? `Frozen for you: ${reason}.` : 'Not frozen for you.'}</p>
    </>
  )
}

function ScoringBody({ example }: { example: ScoringExample }) {
  const players = buildScoringPlayers(example)
  return (
    <>
      {players.map((p) => (
        <div key={p.id} className={styles.scoringPlayer}>
          <strong>
            {p.name}
            {example.wentOut === p.name ? ' (went out)' : ''}
          </strong>
          {p.melds.map((m) => (
            <Labeled key={m.id} label="Meld" cards={m.cards} />
          ))}
          {p.red3s.length > 0 && <Labeled label="Red 3s" cards={p.red3s} />}
          {p.hand.length > 0 && <Labeled label="Left in hand" cards={p.hand} />}
        </div>
      ))}
      <BreakdownTable
        names={players.map((p) => p.name)}
        breakdowns={players.map((p) => example.expected[p.name])}
      />
    </>
  )
}
