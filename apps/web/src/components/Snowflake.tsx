import styles from './Snowflake.module.css'

/** The frozen pile's snowflake, drawn in the ice ink. */
export function Snowflake({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 2v20M4.9 6.5l14.2 11M19.1 6.5 4.9 17.5M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5" />
    </svg>
  )
}

/** On a roomy panel's name line: the pile is frozen for this player. */
export function FrozenChip({ name }: { name: string }) {
  return (
    <span className={styles.chip} title={`The pile is frozen for ${name}`}>
      <Snowflake />
      Pile frozen
    </span>
  )
}
