import type { OpenTable } from '@canasta/server/protocol'
import { useEffect, useState } from 'react'
import { listTables } from '../api'
import styles from './OpenTables.module.css'

/** How often the list refreshes while the page is in view. */
export const REFRESH_MS = 15_000

export interface OpenTablesProps {
  /** Joining uses the name on the home page, so there must be one. */
  canJoin: boolean
  onJoin: (code: string) => void
}

/** The public lobbies, newest first. Shown on the home page under Create and Join. */
export function OpenTables({ canJoin, onJoin }: OpenTablesProps) {
  // null until the first answer. A failed refresh keeps the last list.
  const [tables, setTables] = useState<OpenTable[] | null>(null)

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      const latest = await listTables()
      if (!cancelled && latest) setTables(latest)
    }
    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  return (
    <section className={styles.open} aria-labelledby="open-tables">
      <h2 id="open-tables">Open tables</h2>
      {tables === null ? null : tables.length === 0 ? (
        <p className={styles.empty}>
          <strong>No open tables right now</strong>
          Create a game and switch on <b>Public</b> in the lobby to list yours here.
        </p>
      ) : (
        <>
          {!canJoin && <p className={styles.hint}>Type your name above to join a table.</p>}
          <ul className={styles.tables}>
            {tables.map((t) => (
              <li key={t.code} className={styles.row}>
                <div className={styles.who}>
                  <div className={styles.host}>{t.host}'s table</div>
                  <div className={styles.with}>
                    {t.others.length > 0 ? `with ${t.others.join(', ')}` : 'waiting for players'}
                  </div>
                  <div className={styles.seats}>
                    <span className={styles.pips} aria-hidden="true">
                      {Array.from({ length: t.maxSeats }, (_, i) => (
                        <i key={i} className={i < t.seats ? styles.taken : undefined} />
                      ))}
                    </span>
                    {t.seats} of {t.maxSeats}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canJoin}
                  aria-label={`Join ${t.host}'s table`}
                  onClick={() => onJoin(t.code)}
                >
                  Join
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
