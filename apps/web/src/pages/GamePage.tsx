import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import type { EmptySeats } from '@canasta/server/protocol'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { gameExists, normalizeCode } from '../api'
import type { ConnectionStatus } from '../connection'
import { Announcer } from '../components/Announcer'
import { ChatSounds } from '../components/ChatSounds'
import { RulesDrawer } from '../components/RulesDrawer'
import { TableSounds } from '../components/TableSounds'
import { Toasts } from '../components/Toasts'
import { RulesDrawerContext, type DrawerRequest } from '../rules/drawer'
import type { PageSection } from '../rules/sections'
import { useFocusRescue } from '../focusRescue'
import { usePhone } from '../layout'
import { loadName, loadToken, tokenFromHash } from '../storage'
import { useTitle } from '../title'
import { useGame } from '../useGame'
import { Lobby } from './Lobby'
import { Table } from './Table'
import styles from './Pages.module.css'

/** Navigation state the home page passes: join with this name right away. */
export interface GamePageState {
  join?: string
}

/** After this many failed connects in a row, warn that the code may be wrong. */
const UNREACHABLE_AFTER = 3

export function GamePage() {
  const params = useParams()
  const code = normalizeCode(params.code ?? '')
  if (!code) {
    return (
      <main className={styles.home}>
        <p>That isn't a valid game code.</p>
        <Link to="/">Back to the start</Link>
      </main>
    )
  }
  return <Game key={code} code={code} />
}

interface SessionProps {
  code: string
  linkToken: string | null
  autoJoinName: string | null
  joinsByItself: boolean
}

/**
 * Reads the link token and the pending name, clears the hash, and asks the server whether the
 * game exists before connecting. An unknown answer (`null`) still connects, so a failed lookup
 * falls back to the "Can't reach game" banner.
 */
function Game({ code }: { code: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  // Read once: the hash is removed below, and the name only applies to the first join.
  const [linkToken] = useState(() => tokenFromHash(location.hash))
  const [autoJoinName] = useState(() => (location.state as GamePageState | null)?.join ?? null)
  // With a token or a name the page joins by itself, so it shows "Joining…", not the form.
  const [joinsByItself] = useState(() => Boolean(linkToken || autoJoinName || loadToken(code)))
  const [exists, setExists] = useState<boolean | null | 'checking'>('checking')

  useEffect(() => {
    // Keep the token out of the address bar, history and anything the player shares. Also drop
    // the home page's pending name (read above), so a reload doesn't join by name again.
    if (location.hash || location.state) {
      navigate(
        { pathname: location.pathname, search: location.search },
        { replace: true, state: null },
      )
    }
  }, [location.hash, location.state, location.pathname, location.search, navigate])

  useEffect(() => {
    let cancelled = false
    void gameExists(code).then((found) => {
      if (!cancelled) setExists(found)
    })
    return () => {
      cancelled = true
    }
  }, [code])

  if (exists === 'checking') {
    return (
      <p className={styles.banner} role="status">
        Connecting…
      </p>
    )
  }
  if (exists === false) {
    return (
      <main className={styles.home}>
        <p>There's no game with the code {code}.</p>
        <Link to="/">Back to the start</Link>
      </main>
    )
  }
  return (
    <Session
      code={code}
      linkToken={linkToken}
      autoJoinName={autoJoinName}
      joinsByItself={joinsByItself}
    />
  )
}

function Session({ code, linkToken, autoJoinName, joinsByItself }: SessionProps) {
  const navigate = useNavigate()
  const { state, join, send, typeChat, sendChat, readChat, dismissToast } = useGame(code, {
    linkToken,
    autoJoinName,
  })
  const talk = useMemo(
    () => ({ text: state.chatText, onType: typeChat, onSend: sendChat, onRead: readChat }),
    [state.chatText, typeChat, sendChat, readChat],
  )
  // The drawer lives here, inside the session, so opening it never unmounts the connection.
  const [drawer, setDrawer] = useState<DrawerRequest | null>(null)
  const openRules = useCallback(
    (section: PageSection) => setDrawer((d) => ({ section, id: (d?.id ?? 0) + 1 })),
    [],
  )

  useEffect(() => {
    if (!state.removed) return
    const notice =
      state.removed === 'kicked'
        ? 'The host removed you from the game.'
        : state.removed === 'quit'
          ? 'You quit the game.'
          : 'You left the game.'
    navigate('/', { replace: true, state: { notice } })
  }, [state.removed, navigate])

  const view = state.view
  const phone = usePhone()
  useFocusRescue()
  // The tab says when it's your turn, so a player in another tab can see it.
  const yourTurn =
    view?.status === 'playing' &&
    view.round !== null &&
    view.players[view.round.current]?.id === state.playerId
  useTitle(yourTurn ? `Your turn · Game ${code}` : `Game ${code}`)
  let body
  const waitingForSeat = !state.playerId && (state.joining || (joinsByItself && !state.joinError))
  // Seated but no view yet: the first state is on its way, so don't flash the join form.
  if (waitingForSeat || (state.playerId && !view)) {
    body = <p className={styles.banner}>Joining…</p>
  } else if (!state.playerId || !view) {
    body = (
      <JoinForm
        code={code}
        error={state.joinError}
        seatTaken={state.joinErrorCode === 'SEAT_TAKEN'}
        nameTaken={state.joinErrorCode === 'NAME_TAKEN'}
        emptySeats={state.emptySeats}
        waiting={state.connection !== 'open'}
        onJoin={join}
      />
    )
  } else if (view.status === 'lobby') {
    body = (
      <Lobby
        code={code}
        view={view}
        playerId={state.playerId}
        hostId={state.hostId}
        connected={state.connected}
        isPublic={state.isPublic}
        kicked={state.kicked}
        chat={state.chat}
        offline={state.connection !== 'open'}
        send={send}
        talk={talk}
      />
    )
  } else {
    // A new key each round, and each new hand of a round, remounts the table, which resets
    // staging: card ids repeat per deal.
    const deal = view.round ? `${view.round.number}.${view.round.redeals}` : undefined
    body = (
      <Table
        key={deal}
        code={code}
        view={view}
        state={state}
        send={send}
        talk={talk}
        announcedElsewhere={phone}
      />
    )
  }

  return (
    <RulesDrawerContext.Provider value={openRules}>
      <ConnectionBanner connection={state.connection} failures={state.failures} code={code} />
      {body}
      {/* Outside the table, which remounts with each deal, so the deal itself can play a sound. */}
      {view && state.playerId && <TableSounds view={view} live={state.connection === 'open'} />}
      {state.playerId && <ChatSounds heard={state.chatHeard} playerId={state.playerId} />}
      <Announcer
        view={state.playerId ? view : null}
        playerId={state.playerId}
        chatHeard={state.chatHeard}
        events={phone}
      />
      <button type="button" className={styles.rulesButton} onClick={() => openRules('overview')}>
        Rules
      </button>
      <Toasts toasts={state.toasts} onDismiss={dismissToast} />
      <RulesDrawer request={drawer} onClose={() => setDrawer(null)} />
    </RulesDrawerContext.Provider>
  )
}

function ConnectionBanner({
  connection,
  failures,
  code,
}: {
  connection: ConnectionStatus
  failures: number
  code: string
}) {
  if (connection === 'open') return null
  return (
    <p className={styles.banner} role="status">
      {failures >= UNREACHABLE_AFTER
        ? `Can't reach game ${code}. Check the code, or wait while we keep trying.`
        : connection === 'connecting'
          ? 'Connecting…'
          : 'Reconnecting…'}
    </p>
  )
}

export interface JoinFormProps {
  code: string
  error: string | null
  /** Someone took over this player's seat while they were away: say so first. */
  seatTaken: boolean
  /** The error says someone at the table already has the name. */
  nameTaken: boolean
  emptySeats: EmptySeats | null
  waiting: boolean
  onJoin: (name: string) => void
}

export function JoinForm({
  code,
  error,
  seatTaken,
  nameTaken,
  emptySeats,
  waiting,
  onJoin,
}: JoinFormProps) {
  const [name, setName] = useState(loadName)
  // A taken name is about the name that was sent: once the box changes, it no longer fits.
  const [edited, setEdited] = useState(false)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setEdited(false)
    onJoin(name.trim())
  }
  // Only mid-game: in the lobby a player who lost their link can join again by name.
  const away = emptySeats?.started && !seatTaken ? emptySeats.away : []
  const typed = name.trim().toLowerCase()
  const yours = away.find((seat) => seat.name.toLowerCase() === typed)
  return (
    <main className={styles.home}>
      <h1>{seatTaken ? 'Your seat was taken' : `Join game ${code}`}</h1>
      {seatTaken && error && <p role="alert">{error}</p>}
      {emptySeats && away.length > 0 && <EmptySeatList seats={emptySeats} />}
      <form className={styles.join} onSubmit={submit}>
        <label>
          Your name
          <input
            value={name}
            maxLength={20}
            onChange={(e) => {
              setName(e.target.value)
              setEdited(true)
            }}
          />
        </label>
        <button type="submit" disabled={waiting || !name.trim()}>
          {seatTaken ? 'Join again' : 'Join'}
        </button>
      </form>
      {/* The server refuses the name either way. This says why, and what to do instead. */}
      {emptySeats && yours && (
        <p className={styles.error} role="alert">
          That's the name on {away.length === 1 ? 'the' : 'an'} empty seat. If you're {yours.name},{' '}
          ask {linkMaker(emptySeats)} for your rejoin link. If not, choose another name.
        </p>
      )}
      {error && !seatTaken && !(nameTaken && (yours || edited)) && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </main>
  )
}

/** Who can make a rejoin link: the host, or anyone playing while the host is away. */
function linkMaker({ host }: EmptySeats): string {
  return host ? `${host}, the host,` : 'someone at the table'
}

/**
 * Seats whose players have been away a while, so one whose rejoin link went astray asks for it
 * instead of sitting down as someone new.
 */
function EmptySeatList({ seats }: { seats: EmptySeats }) {
  const id = useId()
  const { away } = seats
  const awayHost = seats.host === null ? away.find((seat) => seat.host) : undefined
  return (
    <section className={styles.emptySeats} aria-labelledby={id}>
      <h2 id={id}>{away.length === 1 ? 'Empty seat' : `${away.length} empty seats`}</h2>
      <ul>
        {away.map((seat) => (
          <li key={seat.name}>
            <span className={styles.offline} aria-hidden="true" />
            {seat.name}
            {seat.host && <span className={styles.emptyHost}>host</span>}
          </li>
        ))}
      </ul>
      <p>
        <strong>{away.length === 1 ? `Are you ${away[0].name}?` : 'Is one of them yours?'}</strong>{' '}
        Ask {linkMaker(seats)} for your rejoin link.
        {awayHost && ` While ${awayHost.name} is away, anyone playing can make one.`}
        {away.length === 1 && ' It puts you back in your seat with your cards and score.'} Joining
        here gives you a new seat instead.
      </p>
      <p>
        <strong>New to the table?</strong> Join below. You'll watch this hand and be dealt in with
        the next one.
      </p>
    </section>
  )
}
