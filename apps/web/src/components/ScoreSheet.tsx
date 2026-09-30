import type { PlayerView } from '@canasta/engine'
import { useEffect, useRef } from 'react'
import { BreakdownTable } from './BreakdownTable'
import styles from './ScoreSheet.module.css'

export interface ScoreSheetProps {
  view: PlayerView
  open: boolean
  onClose: () => void
}

/** Every scored round's breakdown and the running totals, read from `view.history`. */
export function ScoreSheet({ view, open, onClose }: ScoreSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Players who quit keep their columns, marked, after the players still seated.
  const quitIds = new Set(view.quit.map((q) => q.id))
  const everyone = [
    ...view.players,
    ...view.quit.filter((q) => !view.players.some((p) => p.id === q.id)),
  ]
  const label = (p: { id: string; name: string }) =>
    quitIds.has(p.id) ? `${p.name} (quit)` : p.name
  const nameOf = (id: string) => everyone.find((p) => p.id === id)?.name ?? 'Someone'
  const running = new Map<string, number>()

  return (
    <dialog ref={dialogRef} className={styles.sheet} onClose={onClose} aria-label="Scores">
      <button type="button" className={styles.close} onClick={onClose}>
        Close
      </button>
      <h2>Scores</h2>
      {view.history.length === 0 ? (
        <p>No round has been scored yet.</p>
      ) : (
        <>
          <table className={styles.totals}>
            <caption>Running totals</caption>
            <thead>
              <tr>
                <th scope="col">Round</th>
                {everyone.map((p) => (
                  <th key={p.id} scope="col">
                    {label(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.history.map((r) => (
                <tr key={r.round}>
                  <th scope="row">{r.round}</th>
                  {everyone.map((p) => {
                    const b = r.breakdown[p.id]
                    if (!b) return <td key={p.id}>{quitIds.has(p.id) ? 'quit' : '–'}</td>
                    const total = (running.get(p.id) ?? 0) + b.total
                    running.set(p.id, total)
                    return <td key={p.id}>{total.toLocaleString('en-US')}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {[...view.history].reverse().map((r) => {
            const scored = everyone.filter((p) => r.breakdown[p.id])
            return (
              <section key={r.round} className={styles.round} aria-label={`Round ${r.round}`}>
                <h3>Round {r.round}</h3>
                <p>
                  {r.endedBy === 'goingOut' && r.wentOut
                    ? `${nameOf(r.wentOut)} went out.`
                    : 'The stock ran out.'}
                </p>
                <BreakdownTable
                  names={scored.map(label)}
                  breakdowns={scored.map((p) => r.breakdown[p.id])}
                />
              </section>
            )
          })}
        </>
      )}
    </dialog>
  )
}
