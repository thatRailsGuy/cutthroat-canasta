import {
  CANASTA_SIZE,
  CONCEALED_HAND_BONUS,
  GOING_OUT_BONUS,
  MAX_PLAYERS,
  MIN_MELD_SIZE,
  MIN_PLAYERS,
  DIRTY_CANASTA_BONUS,
  CLEAN_CANASTA_BONUS,
  RED_THREE_BONUS,
  WINNING_SCORE,
  type RuleSection,
} from '@canasta/engine'
import { RULES_EXAMPLES } from '@canasta/engine/examples'
import type { ReactNode } from 'react'
import { RuleExample } from './RuleExample'
import styles from './Rules.module.css'
import { cardValueRows, initialMeldRows, tableSizeRows } from './tables'

const fmt = (n: number) => n.toLocaleString('en-US')

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>
        <a href={`#${id}`}>{title}</a>
      </h2>
      {children}
    </section>
  )
}

/** A [clarified] item from the spec: not on the V3 sheet, or settling an ambiguity in it. */
function House({ children }: { children: ReactNode }) {
  return (
    <aside className={styles.house}>
      <strong>House rule</strong> {children}
    </aside>
  )
}

function Examples({ section }: { section: RuleSection }) {
  const examples = RULES_EXAMPLES.filter((e) => e.section === section)
  if (examples.length === 0) return null
  return (
    <div className={styles.examples}>
      {examples.map((e) => (
        <RuleExample key={e.id} example={e} />
      ))}
    </div>
  )
}

export function QuickReference() {
  return (
    <Section id="quick-reference" title="Quick reference">
      <div className={styles.quick}>
        <dl>
          <dt>Goal</dt>
          <dd>The highest total after a round in which someone reaches {fmt(WINNING_SCORE)}</dd>
          <dt>Meld</dt>
          <dd>{MIN_MELD_SIZE}+ cards of one rank, at least 2 natural, wilds ≤ naturals</dd>
          <dt>Canasta</dt>
          <dd>
            {CANASTA_SIZE}+ cards: clean {CLEAN_CANASTA_BONUS}, dirty {DIRTY_CANASTA_BONUS}
          </dd>
          <dt>Red 3</dt>
          <dd>
            +{RED_THREE_BONUS} each if you melded this round, −{RED_THREE_BONUS} if not
          </dd>
          <dt>Going out</dt>
          <dd>
            +{GOING_OUT_BONUS}, plus {CONCEALED_HAND_BONUS} if concealed. Needs a canasta; not on
            your first turn
          </dd>
          <dt>Initial meld</dt>
          <dd>
            {initialMeldRows()
              .map((r) => `${r.score}: ${r.minimum}`)
              .join(' · ')}
          </dd>
        </dl>
      </div>
    </Section>
  )
}

export function RulesContent() {
  return (
    <>
      <QuickReference />

      <Section id="overview" title="Overview">
        <p>
          Cutthroat Canasta is Canasta for {MIN_PLAYERS} to {MAX_PLAYERS} players, each playing for
          themselves. You score by laying down melds of the same rank, and above all by building
          canastas: melds of {CANASTA_SIZE} or more cards. A round ends when someone goes out or the
          stock runs out. The game ends after the round in which someone reaches{' '}
          {fmt(WINNING_SCORE)} points.
        </p>
      </Section>

      <Section id="setup" title="Setup">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Players</th>
              <th scope="col">Decks (with 2 Jokers each)</th>
              <th scope="col">Cards dealt</th>
            </tr>
          </thead>
          <tbody>
            {tableSizeRows().map((r) => (
              <tr key={r.players}>
                <td>{r.players}</td>
                <td>{r.decks}</td>
                <td>{r.hand}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          After the deal, Red 3s are laid face up and replaced from the stock automatically, until
          nobody holds one. One card is turned up to start the discard pile. The dealer moves one
          seat to the left each round, and the player on the dealer's left goes first.
        </p>
        <House>
          If the first upcard is a Red 3 or a wild, it stays in the pile and freezes it for
          everyone. It lies sideways under the pile, so everyone can see why the pile is frozen.
          Nobody can pick up the pile while it is on top. A Red 3 picked up with the pile is laid
          face up like any other Red 3.
        </House>
        <House>The sheet's Perfect Cut Bonus is not used online.</House>
      </Section>

      <Section id="card-values" title="Card values">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Card</th>
              <th scope="col">Role</th>
              <th scope="col">Points</th>
            </tr>
          </thead>
          <tbody>
            {cardValueRows().map((r) => (
              <tr key={r.cards}>
                <td>{r.cards}</td>
                <td>{r.role}</td>
                <td>{r.points}</td>
              </tr>
            ))}
            <tr>
              <td>Red 3</td>
              <td>Bonus card, laid face up</td>
              <td>{RED_THREE_BONUS}</td>
            </tr>
          </tbody>
        </table>
        <House>
          Red 3s score a flat {RED_THREE_BONUS} each. There is no bonus for holding all four.
        </House>
      </Section>

      <Section id="turn" title="Your turn">
        <ol>
          <li>
            <strong>Draw</strong> one card from the stock, or pick up the discard pile (see below).
            A Red 3 you draw is laid face up and replaced automatically.
          </li>
          <li>
            <strong>Meld</strong> as many cards as you like.
          </li>
          <li>
            <strong>Discard</strong> one card to end your turn. Discarding your last card is going
            out.
          </li>
        </ol>
        <House>
          If the stock is empty when you must draw, you may pick up the pile if that is legal for
          you. Otherwise, drawing ends the round at once: nobody gets a going-out bonus, and
          everyone scores what they have. The round also ends this way if the only cards left to
          draw are Red 3s.
        </House>
      </Section>

      <Section id="melds" title="Melds and canastas">
        <ul>
          <li>
            A meld is {MIN_MELD_SIZE} or more cards of one natural rank (4 through Ace), with at
            least 2 natural cards.
          </li>
          <li>3s can never be melded, Black or Red, not even when going out.</li>
          <li>
            You can add cards from your hand to any of your own melds, including a finished canasta,
            as long as the meld stays legal. You can never add to another player's melds.
          </li>
          <li>
            A <strong>canasta</strong> is a meld of {CANASTA_SIZE} or more cards. It is{' '}
            <em>clean</em> with no wilds ({CLEAN_CANASTA_BONUS} bonus) and <em>dirty</em> with any
            wild ({DIRTY_CANASTA_BONUS} bonus).
          </li>
          <li>
            Everything you meld in one play is checked together, so several melds can add up to your
            initial meld.
          </li>
        </ul>
        <House>
          Jokers and 2s together may not outnumber the natural cards in a meld: wilds ≤ naturals.
        </House>
        <House>
          You may have only one unfinished meld of each rank. Once your meld of a rank is a canasta,
          you may start another meld of that rank with at least {MIN_MELD_SIZE} cards that make a
          legal meld on their own.
        </House>
        <House>Adding a wild to a clean canasta makes it dirty.</House>
        <Examples section="melds" />
      </Section>

      <Section id="initial-meld" title="Initial meld">
        <p>
          Your first meld play in each round must be worth a minimum number of points, based on your
          total score at the start of the round:
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Your score</th>
              <th scope="col">Minimum</th>
            </tr>
          </thead>
          <tbody>
            {initialMeldRows().map((r) => (
              <tr key={r.score}>
                <td>{r.score}</td>
                <td>{r.minimum}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <House>
          Only card values count toward the minimum: Red 3s and canasta bonuses do not. If you make
          your initial meld while picking up the pile, the top discard counts, but the rest of the
          pile does not.
        </House>
        <Examples section="initial-meld" />
      </Section>

      <Section id="pickup" title="Picking up the pile">
        <ul>
          <li>
            The pile is <strong>frozen for you</strong> until you have picked it up once this round.
            It is also frozen for everyone while a wild is anywhere in it, or when a wild or Red 3
            started it. The card that froze it lies sideways under the pile.
          </li>
          <li>Nobody can pick up the pile while a Black 3, a Red 3 or a wild is on top.</li>
          <li>
            To pick up the pile, you meld the top card at once, in the same play. Then the rest of
            the pile goes into your hand.
          </li>
          <li>
            <strong>Frozen for you:</strong> the top card must be melded with a natural pair of its
            rank from your hand. The three start a new meld, or join your unfinished meld of that
            rank.
          </li>
          <li>
            <strong>Not frozen for you:</strong> the top card can start a new meld with a natural
            pair, or with one natural and one wild from your hand. Or it can join one of your melds
            of that rank that is not yet a canasta.
          </li>
          <li>
            The same play can include other melds and additions from your hand. If it is your
            initial meld, the whole play must reach the minimum.
          </li>
          <li>
            Once you pick up the pile, it stays unfrozen for you for the rest of the round, unless a
            wild freezes it again.
          </li>
        </ul>
        <House>
          A finished canasta can never take the top card. With a canasta of 5s and no unfinished
          meld of 5s, you can only take a discarded 5 by starting a new meld of 5s from your hand.
        </House>
        <Examples section="pickup" />
      </Section>

      <Section id="going-out" title="Going out">
        <ul>
          <li>
            To go out you need at least one canasta after your play. Then either meld every card
            left in your hand, or discard your last card.
          </li>
          <li>You can't go out on your own first turn of a round.</li>
          <li>Going out ends the round immediately.</li>
        </ul>
        <House>
          When you are not allowed to go out, a play must leave you at least 2 cards: one to discard
          and one to keep.
        </House>
        <Examples section="going-out" />
      </Section>

      <Section id="scoring" title="Scoring">
        <p>At the end of each round, each player scores:</p>
        <ul>
          <li>+ the value of every card in their melds</li>
          <li>
            + {CLEAN_CANASTA_BONUS} for each clean canasta and {DIRTY_CANASTA_BONUS} for each dirty
            canasta
          </li>
          <li>
            + {RED_THREE_BONUS} for each Red 3 if they melded this round, or − {RED_THREE_BONUS}{' '}
            each if they did not
          </li>
          <li>− the value of every card left in their hand</li>
          <li>
            For the player who went out: + {GOING_OUT_BONUS}, and + {CONCEALED_HAND_BONUS} more for
            a concealed hand: they had not melded at all before the turn they went out on
          </li>
        </ul>
        <p>If the stock ran out, nobody gets the going-out or concealed bonus.</p>
        <House>The concealed bonus still counts if you picked up the pile on that turn.</House>
        <Examples section="scoring" />
      </Section>

      <Section id="winning" title="Winning">
        <p>
          The game ends after a round in which at least one player's total reaches{' '}
          {fmt(WINNING_SCORE)}. The highest total wins.
        </p>
        <House>An exact tie for the highest total is a shared win.</House>
      </Section>

      <Section id="house-rules" title="Our house rules vs. standard Canasta">
        <p>Standard here means the usual four-player partnership game.</p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Here</th>
              <th scope="col">Standard Canasta</th>
            </tr>
          </thead>
          <tbody>
            {HOUSE_DIFFERENCES.map(([here, standard]) => (
              <tr key={here}>
                <td>{here}</td>
                <td>{standard}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  )
}

const HOUSE_DIFFERENCES: [string, string][] = [
  ['Everyone plays for themselves', 'Two partnerships share melds and scores'],
  ['Wilds may not outnumber naturals in a meld', 'At most 3 wilds in a meld'],
  ['3s can never be melded', 'Black 3s can be melded when going out'],
  [`Red 3s are a flat ${RED_THREE_BONUS} each`, 'All four Red 3s score double'],
  [
    'The pile is frozen for you until your first pickup of the round',
    'The pile is frozen for a side until it has made its initial meld',
  ],
  ['You may start another meld of a rank once your first one is a canasta', 'One meld per rank'],
  [
    'A wild or Red 3 upcard stays in the pile and freezes it',
    'The same, but a further card is turned up on top of it',
  ],
  ['A finished canasta cannot take the top discard', 'The top discard can join a canasta'],
  ["You can't go out on your first turn", 'You may go out on any turn'],
  [
    `Going out concealed earns ${GOING_OUT_BONUS} + ${CONCEALED_HAND_BONUS}`,
    'Going out concealed earns 200 instead of 100',
  ],
  [
    "An empty stock ends the round when a player must draw and can't legally pick up the pile",
    'Play continues while players can take the discard',
  ],
]
