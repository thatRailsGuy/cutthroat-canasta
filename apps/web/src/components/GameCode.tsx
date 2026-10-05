import styles from './GameCode.module.css'

export interface GameCodeProps {
  code: string
  /** Smaller tiles, for the host's drawer. */
  small?: boolean
}

/**
 * The game code with each character on its own tile, in two groups of three, so it reads out
 * loud one character at a time. A screen reader hears it spelled out instead of the tiles.
 */
export function GameCode({ code, small = false }: GameCodeProps) {
  const half = Math.ceil(code.length / 2)
  const tiles = (chars: string) => [...chars].map((ch, i) => <span key={i}>{ch}</span>)
  return (
    <div className={`${styles.code} ${small ? styles.small : ''}`}>
      <span className={styles.label}>Game code</span>
      <span className={styles.srOnly}>{[...code].join(' ')}</span>
      <span className={styles.tiles} aria-hidden="true">
        {tiles(code.slice(0, half))}
        <span className={styles.dash} />
        {tiles(code.slice(half))}
      </span>
    </div>
  )
}
