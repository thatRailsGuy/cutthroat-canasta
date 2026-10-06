import { useState } from 'react'
import { playTest } from '../soundPlayer'
import type { Cue, Sound } from '../sounds'
import styles from './SoundboardPage.module.css'

/**
 * Dev only (`/dev/sounds`): every sound the table can make, each on its own button, for
 * working on the sounds without setting up a moment at the table. It ignores the sound step.
 */
export default function SoundboardPage() {
  const [meldCards, setMeldCards] = useState(4)

  return (
    <main className={styles.sheet}>
      <header className={styles.header}>
        <h1>Soundboard</h1>
        <span className={styles.route}>/dev/sounds · dev builds only</span>
      </header>
      <p className={styles.intro}>
        Every sound the table can make, at full volume whatever your sound step is. <b>Yours</b>{' '}
        plays it at full volume. <b>Someone else’s</b> plays it the way another player’s move
        sounds: quieter and muffled.
      </p>

      <section className={styles.grid} aria-label="Sounds">
        {TILES.map((tile) => (
          <article key={tile.sound} className={styles.tile}>
            <h3>
              {tile.name}
              {!tile.both && <span className={styles.step}>Turn alert</span>}
            </h3>
            <p className={styles.what}>{tile.what}</p>
            {tile.sound === 'meld' ? (
              <div className={styles.count}>
                <label htmlFor="meld-cards">Cards</label>
                <input
                  id="meld-cards"
                  type="range"
                  min={1}
                  max={11}
                  value={meldCards}
                  onChange={(e) => setMeldCards(Number(e.target.value))}
                />
                <output htmlFor="meld-cards">{meldCards}</output>
              </div>
            ) : (
              <p className={styles.when}>{tile.when}</p>
            )}
            <div className={styles.plays}>
              <button
                type="button"
                className={styles.mine}
                onClick={() => playTest({ sound: tile.sound, mine: true, cards: meldCards })}
              >
                {tile.both ? 'Yours' : 'Play'}
              </button>
              {tile.both && (
                <button
                  type="button"
                  onClick={() => playTest({ sound: tile.sound, mine: false, cards: meldCards })}
                >
                  Someone else’s
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className={styles.sequences} aria-labelledby="sequences">
        <h2 id="sequences">In a row</h2>
        <p className={styles.when}>
          Queued the way the table queues them, so you can hear the gaps between sounds.
        </p>
        <div className={styles.plays}>
          {SEQUENCES.map(([label, cues]) => (
            <button key={label} type="button" onClick={() => playTest(...cues)}>
              {label}
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

const TILES: { sound: Sound; name: string; what: string; when: string; both: boolean }[] = [
  {
    sound: 'turn',
    name: 'Your turn',
    what: 'Restaurant bell, tapped twice',
    when: 'Your turn starts.',
    both: false,
  },
  {
    sound: 'roundOver',
    name: 'Round over',
    what: 'Pencil tally, pencil down, then a shuffle',
    when: 'Someone goes out or the stock runs out.',
    both: false,
  },
  {
    sound: 'gameOver',
    name: 'Game over',
    what: 'Orchestral jingle',
    when: 'Someone passes the winning score.',
    both: false,
  },
  {
    sound: 'draw',
    name: 'Draw',
    what: 'Light card tap',
    when: 'A card comes off the stock.',
    both: true,
  },
  {
    sound: 'discard',
    name: 'Discard',
    what: 'Card placed down',
    when: 'A card goes on the pile.',
    both: true,
  },
  { sound: 'meld', name: 'Meld', what: 'One tap per card, unevenly spaced', when: '', both: true },
  {
    sound: 'pickup',
    name: 'Take the pile',
    what: 'Cards slid up, then two squaring taps',
    when: 'Someone picks up the discard pile.',
    both: true,
  },
  {
    sound: 'canasta',
    name: 'Canasta',
    what: 'Old cash register, drawer and bell',
    when: 'A meld reaches seven cards.',
    both: true,
  },
]

const SEQUENCES: [string, Cue[]][] = [
  [
    'Your turn: bell, draw, meld 3, discard',
    [
      { sound: 'turn', mine: true },
      { sound: 'draw', mine: true },
      { sound: 'meld', mine: true, cards: 3 },
      { sound: 'discard', mine: true },
    ],
  ],
  [
    'Ben’s turn: draw, meld 5 + canasta, discard',
    [
      { sound: 'draw', mine: false },
      { sound: 'meld', mine: false, cards: 5 },
      { sound: 'canasta', mine: false },
      { sound: 'discard', mine: false },
    ],
  ],
  [
    'Take the pile + canasta',
    [
      { sound: 'pickup', mine: true },
      { sound: 'canasta', mine: true },
    ],
  ],
  [
    'Go out: meld 4, round over',
    [
      { sound: 'meld', mine: true, cards: 4 },
      { sound: 'roundOver', mine: true },
    ],
  ],
]
