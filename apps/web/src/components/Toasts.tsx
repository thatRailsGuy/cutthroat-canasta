import { useEffect, useState } from 'react'
import type { Toast } from '../gameState'
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
  return (
    <div className={styles.toasts} role="alert" aria-live="assertive">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
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
