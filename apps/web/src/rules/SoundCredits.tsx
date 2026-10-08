import styles from './Rules.module.css'

const CC_BY = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }
const CC0 = { name: 'CC0', url: null }

/** The recordings behind the table's sounds, as their licenses ask (src/sounds/LICENSE.txt). */
const CREDITS: {
  moment: string
  works: { title: string; author: string; url: string }[]
  license: { name: string; url: string | null }
  changed?: string
}[] = [
  {
    moment: 'Your turn',
    works: [
      {
        title: 'Restaurant Bell',
        author: 'Diego25',
        url: 'https://freesound.org/people/Diego25/sounds/394625/',
      },
    ],
    license: CC_BY,
    changed: 'Trimmed and faded out.',
  },
  {
    moment: 'Canasta',
    works: [
      {
        title: 'Cash Register',
        author: 'kiddpark',
        url: 'https://freesound.org/people/kiddpark/sounds/201159/',
      },
    ],
    license: CC_BY,
    changed: 'Trimmed, made louder and faded out.',
  },
  {
    moment: 'Game over',
    works: [
      {
        title: 'Jingle Achievement 00',
        author: 'LittleRobotSoundFactory',
        url: 'https://freesound.org/people/LittleRobotSoundFactory/sounds/270404/',
      },
    ],
    license: CC_BY,
    changed: 'Mixed to mono and faded out.',
  },
  {
    moment: 'Round over',
    works: [
      {
        title: 'Pencil write words',
        author: 'Trtle.T',
        url: 'https://freesound.org/people/Trtle.T/sounds/809941/',
      },
      {
        title: 'pencil drop',
        author: 'toddcircle',
        url: 'https://freesound.org/people/toddcircle/sounds/451649/',
      },
      {
        title: 'Riffle Card Shuffle',
        author: 'Kodack',
        url: 'https://freesound.org/people/Kodack/sounds/256508/',
      },
    ],
    license: CC0,
  },
  {
    moment: 'Chat',
    works: [
      {
        title: 'medium wine glass',
        author: 'Tairblenn',
        url: 'https://freesound.org/people/Tairblenn/sounds/549900/',
      },
    ],
    license: CC0,
  },
  {
    moment: 'Cards',
    works: [
      { title: 'Casino Audio', author: 'Kenney', url: 'https://kenney.nl/assets/casino-audio' },
    ],
    license: CC0,
  },
]

/** Only on the rules page: the drawer at the table leaves it out, and so does printing. */
export function SoundCredits() {
  return (
    <section
      id="sound-credits"
      className={`${styles.section} ${styles.credits}`}
      aria-labelledby="sound-credits-title"
    >
      <h2 id="sound-credits-title">
        <a href="#sound-credits">Sound credits</a>
      </h2>
      <p>The table’s sounds are recordings shared by these people. Thank you.</p>
      <ul>
        {CREDITS.map(({ moment, works, license, changed }) => (
          <li key={moment}>
            <span className={styles.creditFor}>{moment}</span>
            <span>
              {works.map((work, i) => (
                <span key={work.url}>
                  {i > 0 && (i === works.length - 1 ? ' and ' : ', ')}
                  <a href={work.url}>{work.title}</a> by {work.author}
                </span>
              ))}
              {' · '}
              {license.url ? (
                <a className={styles.license} href={license.url}>
                  {license.name}
                </a>
              ) : (
                <span className={styles.license}>{license.name}</span>
              )}
              {changed && <span className={styles.changed}>{changed}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
