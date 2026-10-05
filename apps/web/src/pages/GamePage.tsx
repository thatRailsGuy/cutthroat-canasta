import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { gameExists, normalizeCode } from '../api'
import type { ConnectionStatus } from '../connection'
import { RulesDrawer } from '../components/RulesDrawer'
import { TableSounds } from '../components/TableSounds'
import { Toasts } from '../components/Toasts'
import { RulesDrawerContext, type DrawerRequest } from '../rules/drawer'
import type { PageSection } from '../rules/sections'
import { loadName, loadToken, tokenFromHash } from '../storage'
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
    body = <Table key={deal} code={code} view={view} state={state} send={send} talk={talk} />
  }

  return (
    <RulesDrawerContext.Provider value={openRules}>
      <ConnectionBanner connection={state.connection} failures={state.failures} code={code} />
      {body}
      {/* Outside the table, which remounts with each deal, so the deal itself can play a sound. */}
      {view && state.playerId && <TableSounds view={view} live={state.connection === 'open'} />}
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

function JoinForm({
  code,
  error,
  waiting,
  onJoin,
}: {
  code: string
  error: string | null
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
      <h1>Join game {code}</h1>
      <form className={styles.join} onSubmit={submit}>
        <label>
          Your name
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" disabled={waiting || !name.trim()}>
          Join
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
    </main>
  )
}
