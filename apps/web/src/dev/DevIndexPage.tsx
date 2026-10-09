import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { createGame, normalizeCode, rejoinLink } from '../api'
import { GameCode } from '../components/GameCode'
import { useTitle } from '../title'
import { holdSeats, SEAT_NAMES, type HeldSeats, type Seat } from './seats'
import sheet from './SoundboardPage.module.css'
import styles from './DevIndexPage.module.css'

/** Every dev page, for the tiles. A new dev page is one more line here, and its route in App. */
const DEV_PAGES = [
  {
    path: '/dev/table',
    name: 'Table preview',
    what: 'A made-up three-player table',
    when: 'Buttons act out moments on it: melds, canastas, a frozen pile, a late joiner, round end.',
  },
  {
    path: '/dev/sounds',
    name: 'Soundboard',
    what: 'Every sound on its own button',
    when: 'Plays at full volume whatever the sound step is, yours or someone else’s.',
  },
]

const REAL_PAGES = [
  { path: '/', name: 'Home' },
  { path: '/rules', name: 'Rules' },
  { path: '/learn', name: 'Learn to play' },
]

interface MadeGame {
  code: string
  deal: boolean
  isPublic: boolean
}

/**
 * Dev only (`/dev`): links to every dev page and the real pages, and a way to make a game with
 * made-up players. This page holds those players' seats online until you sit in one, which
 * opens it in a new tab, or leave the page.
 */
export default function DevIndexPage() {
  useTitle('Dev')
  const navigate = useNavigate()
  const [jumpCode, setJumpCode] = useState('')
  const [jumpError, setJumpError] = useState<string | null>(null)
  const [players, setPlayers] = useState(3)
  const [stage, setStage] = useState<'lobby' | 'dealt'>('dealt')
  const [isPublic, setIsPublic] = useState(false)
  const [busy, setBusy] = useState(false)
  const [game, setGame] = useState<MadeGame | null>(null)
  const [seats, setSeats] = useState<Seat[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const held = useRef<HeldSeats | null>(null)

  useEffect(() => () => held.current?.stop(), [])

  const jump = (event: FormEvent) => {
    event.preventDefault()
    const code = normalizeCode(jumpCode)
    if (code) navigate(`/g/${code}`)
    else setJumpError('Game codes are 6 letters and numbers.')
  }

  const startOver = () => {
    held.current?.stop()
    held.current = null
    setGame(null)
    setSeats([])
    setErrors([])
  }

  const make = async (event: FormEvent) => {
    event.preventDefault()
    startOver()
    setBusy(true)
    try {
      const code = await createGame()
      const deal = stage === 'dealt'
      setGame({ code, deal, isPublic: isPublic && !deal })
      held.current = holdSeats({
        code,
        players,
        deal,
        isPublic,
        onSeats: setSeats,
        onError: (message) => setErrors((list) => [...list, message]),
      })
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Could not create a game.'])
    } finally {
      setBusy(false)
    }
  }

  const seated = seats.length > 0 && seats.every((seat) => seat.token !== null)

  return (
    <main className={sheet.sheet}>
      <header className={sheet.header}>
        <h1>Dev</h1>
        <span className={sheet.route}>/dev · dev builds only</span>
      </header>
      <p className={sheet.intro}>
        Every page for trying out the app, and a quick way to sit down at a game with as many
        players as you need.
      </p>

      <section className={styles.section} aria-labelledby="dev-pages">
        <h2 id="dev-pages">Dev pages</h2>
        <div className={sheet.grid}>
          {DEV_PAGES.map((page) => (
            <Link key={page.path} to={page.path} className={`${sheet.tile} ${styles.tile}`}>
              <h3>
                {page.name}
                <span className={styles.path}>{page.path}</span>
              </h3>
              <p className={sheet.what}>{page.what}</p>
              <p className={sheet.when}>{page.when}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="real-pages">
        <h2 id="real-pages">The real pages</h2>
        <ul className={styles.links}>
          {REAL_PAGES.map((page) => (
            <li key={page.path}>
              <Link to={page.path}>
                {page.name} <span>{page.path}</span>
              </Link>
            </li>
          ))}
        </ul>
        <form className={styles.jump} onSubmit={jump}>
          <label htmlFor="jump-code">Go to a game</label>
          <input
            id="jump-code"
            value={jumpCode}
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => {
              setJumpCode(e.target.value)
              setJumpError(null)
            }}
          />
          <button type="submit" disabled={jumpCode.trim().length === 0}>
            Go
          </button>
          {jumpError && <p role="alert">{jumpError}</p>}
        </form>
      </section>

      <section className={styles.section} aria-labelledby="make-game">
        <h2 id="make-game">Make a game</h2>
        <div className={styles.setup}>
          <form className={styles.form} onSubmit={(e) => void make(e)}>
            <div className={styles.field}>
              <label htmlFor="dev-players">Players</label>
              <div className={styles.players}>
                <input
                  id="dev-players"
                  type="range"
                  min={2}
                  max={SEAT_NAMES.length}
                  value={players}
                  onChange={(e) => setPlayers(Number(e.target.value))}
                />
                <output htmlFor="dev-players">{players}</output>
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="dev-stage">Leave it at</label>
              <select
                id="dev-stage"
                value={stage}
                onChange={(e) => setStage(e.target.value as 'lobby' | 'dealt')}
              >
                <option value="lobby">The lobby</option>
                <option value="dealt">The first deal</option>
              </select>
            </div>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={isPublic && stage === 'lobby'}
                disabled={stage !== 'lobby'}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span>
                Public table
                <small>Listed under Open tables on the home page. Only in the lobby.</small>
              </span>
            </label>
            <button type="submit" className={styles.primary} disabled={busy}>
              Make game
            </button>
          </form>

          <div className={styles.result} aria-live="polite">
            {game ? (
              <>
                <div className={styles.made}>
                  <GameCode code={game.code} small />
                  <span className={styles.chip}>
                    {!seated ? 'Seating…' : game.deal ? 'Round 1 dealt' : 'In the lobby'}
                  </span>
                  {game.isPublic && seated && (
                    <span className={`${styles.chip} ${styles.cool}`}>Public table</span>
                  )}
                </div>
                <ul className={styles.seats}>
                  {seats.map((seat, i) => (
                    <li key={seat.name}>
                      <span
                        className={`${styles.dot} ${seat.held ? '' : styles.away}`}
                        aria-hidden="true"
                      />
                      <span className={styles.who}>
                        <b>{seat.name}</b>
                        {i === 0 && ' · host'}
                        <small>
                          {!seat.token
                            ? 'Joining…'
                            : seat.held
                              ? 'Held online by this page'
                              : 'Opened in another tab'}
                        </small>
                      </span>
                      {seated && seat.token && (
                        <a
                          className={styles.sit}
                          href={rejoinLink(game.code, seat.token)}
                          target="_blank"
                          rel="noopener"
                          onClick={() => held.current?.letGo(i)}
                        >
                          {seat.held ? 'Sit here' : 'Open again'}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
                <div className={styles.foot}>
                  <span>Leaving this page lets go of the seats it holds.</span>
                  <button type="button" onClick={startOver}>
                    Start over
                  </button>
                </div>
              </>
            ) : (
              <p className={styles.empty}>
                Your game’s seats show up here, each with a link to sit in it.
              </p>
            )}
            {errors.map((message, i) => (
              <p key={i} className={styles.error} role="alert">
                {message}
              </p>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
