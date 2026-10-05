import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { createGame, normalizeCode } from '../api'
import { loadName, saveName } from '../storage'
import type { GamePageState } from './GamePage'
import styles from './Pages.module.css'

export function HomePage() {
  const navigate = useNavigate()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [name, setName] = useState(loadName)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const trimmed = name.trim()

  const go = (gameCode: string) => {
    saveName(trimmed)
    navigate(`/g/${gameCode}`, { state: { join: trimmed } satisfies GamePageState })
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      go(await createGame())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a game.')
      setBusy(false)
    }
  }

  const joinByCode = (event: FormEvent) => {
    event.preventDefault()
    const normalized = normalizeCode(code)
    if (normalized) go(normalized)
    else setError('Game codes are 6 letters and numbers, like HT7KM4.')
  }

  return (
    <main className={styles.home}>
      <h1>Cutthroat Canasta</h1>
      {notice && <p className={styles.notice}>{notice}</p>}
      <label>
        Your name
        <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="button" disabled={!trimmed || busy} onClick={() => void create()}>
        Create a game
      </button>
      <form className={styles.join} onSubmit={joinByCode}>
        <label>
          Game code
          <input
            value={code}
            maxLength={6}
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <button type="submit" disabled={!trimmed || code.trim().length === 0}>
          Join
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
      <p className={styles.links}>
        <Link to="/learn">Learn to play</Link> · <Link to="/rules">Read the rules</Link>
      </p>
    </main>
  )
}
