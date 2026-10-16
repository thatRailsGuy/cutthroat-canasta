import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { gameExists, normalizeCode } from '../api'
import type { ConnectionStatus } from '../connection'
import { AboveModals, useLiveRegion } from '../components/AboveModals'
import { Announcer } from '../components/Announcer'
import { ChatSounds } from '../components/ChatSounds'
import { RulesDrawer } from '../components/RulesDrawer'
import { TableSounds } from '../components/TableSounds'
import { Toasts } from '../components/Toasts'
import { RulesDrawerContext, useRulesDrawer } from '../rules/drawer'
import { useFocusRescue } from '../focusRescue'
import { usePhone } from '../layout'
import { useTopModal } from '../modals'
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
  const rules = useRulesDrawer()

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
        awaySince={state.awaySince}
        isPublic={state.isPublic}
        kicked={state.kicked}
        chat={state.chat}
        notices={state.notices}
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
    <RulesDrawerContext.Provider value={rules.open}>
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
      <button type="button" className={styles.rulesButton} onClick={() => rules.open('overview')}>
        Rules
      </button>
      <Toasts toasts={state.toasts} onDismiss={dismissToast} />
      <RulesDrawer request={rules.request} onClose={rules.close} />
    </RulesDrawerContext.Provider>
  )
}

/**
 * Shown at the top of the page while the game isn't connected. The page behind an open dialog
 * is dimmed and inert, so the dialog shows it at its top too. The one on the page stays put, so
 * the page doesn't jump behind the dialog.
 */
export function ConnectionBanner({
  connection,
  failures,
  code,
}: {
  connection: ConnectionStatus
  failures: number
  code: string
}) {
  const live = useLiveRegion('status')
  const inModal = useTopModal() !== null
  const text =
    connection === 'open'
      ? null
      : failures >= UNREACHABLE_AFTER
        ? `Can't reach game ${code}. Check the code, or wait while we keep trying.`
        : connection === 'connecting'
          ? 'Connecting…'
          : 'Reconnecting…'
  // The live region stays in the page while connected, because it has to be there before its
  // text changes.
  useEffect(() => {
    if (text) live.say(text)
    else live.clear()
  }, [text, live])

  return (
    <>
      {text && <p className={styles.banner}>{text}</p>}
      <AboveModals first live={live}>
        {text && inModal && <p className={styles.banner}>{text}</p>}
      </AboveModals>
    </>
  )
}

function JoinForm({
  code,
  error,
  seatTaken,
  waiting,
  onJoin,
}: {
  code: string
  error: string | null
  /** Someone took over this player's seat while they were away: say so first. */
  seatTaken: boolean
  waiting: boolean
  onJoin: (name: string) => void
}) {
  const [name, setName] = useState(loadName)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) onJoin(name.trim())
  }
  return (
    <main className={styles.home}>
      <h1>{seatTaken ? 'Your seat was taken' : `Join game ${code}`}</h1>
      {seatTaken && error && <p role="alert">{error}</p>}
      <form className={styles.join} onSubmit={submit}>
        <label>
          Your name
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={waiting || !name.trim()}>
          {seatTaken ? 'Join again' : 'Join'}
        </button>
      </form>
      {error && !seatTaken && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </main>
  )
}
