import { Link } from 'react-router'
import { STEPS } from './lesson'
import styles from './Coach.module.css'

export interface CoachProps {
  step: number
  /** Why your last move was refused. */
  hint: string | null
  onNext: () => void
  onRestart: () => void
}

/** The lesson card: what to do now, and why. */
export function Coach({ step, hint, onNext, onRestart }: CoachProps) {
  const current = STEPS[step]
  const last = step === STEPS.length - 1
  const readOnly = !current.allow && !current.waiting

  return (
    <section className={styles.coach} aria-label="Lesson">
      <p className={styles.count}>
        Lesson · step {step + 1} of {STEPS.length}
      </p>
      <h2 className={styles.title}>{current.title}</h2>
      <p className={styles.body}>{current.body}</p>
      <p className={styles.hint} role="status">
        {hint}
      </p>
      <div className={styles.buttons}>
        {last ? (
          <>
            <Link className={styles.primary} to="/">
              Play a real game
            </Link>
            <Link to="/rules">Read the rules</Link>
            <button type="button" onClick={onRestart}>
              Play it again
            </button>
          </>
        ) : (
          <>
            {readOnly && (
              <button type="button" className={styles.primary} onClick={onNext}>
                Next
              </button>
            )}
            {step > 0 && (
              <button type="button" onClick={onRestart}>
                Start over
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}
