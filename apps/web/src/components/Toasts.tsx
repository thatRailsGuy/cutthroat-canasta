import { useCallback, useEffect, useRef, useState } from 'react'
import type { Toast } from '../gameState'
import { AboveModals, useLiveRegion } from './AboveModals'
import styles from './Toasts.module.css'
import { WhyLink } from './WhyLink'

const TOAST_MS = 6000

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: number) => void
}) {
  const live = useLiveRegion('alert')
  // Toast ids only go up. One left after a newer one goes was said when it came.
  const said = useRef(0)
  useEffect(() => {
    const fresh = toasts.filter((t) => t.id > said.current)
    if (fresh.length === 0) return
    said.current = fresh[fresh.length - 1].id
    live.say(fresh.map((t) => t.message).join(' '))
  }, [toasts, live])

  return (
    <AboveModals live={live}>
      <div className={styles.toasts}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </AboveModals>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  // Pointing at a toast or tabbing into it (to its Why? link) holds it, and the time starts
  // over when you move away, so nobody loses it while reading.
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (held) return
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss, held])
  return (
    <div
      className={styles.toast}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false)
      }}
    >
      <span>{toast.message}</span> {toast.section && <WhyLink section={toast.section} />}
      <button type="button" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
        ×
      </button>
    </div>
  )
}

/** Toasts kept apart from a game, which keeps its own: for the preview page and tests. */
export function useToastList(initial: Toast[] = []) {
  const [toasts, setToasts] = useState(initial)
  const add = useCallback((toast: Toast) => setToasts((ts) => [...ts, toast]), [])
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  return { toasts, add, dismiss }
}
