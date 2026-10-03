import { useMemo } from 'react'
import { encode } from 'uqr'
import styles from './QrCode.module.css'

export interface QrCodeProps {
  text: string
  label: string
}

/** A QR code drawn in ink on a paper card. The 4-module border is the quiet zone scanners need. */
export function QrCode({ text, label }: QrCodeProps) {
  const { size, path } = useMemo(() => {
    const qr = encode(text, { border: 4 })
    let d = ''
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`
      }),
    )
    return { size: qr.size, path: d }
  }, [text])
  return (
    <svg
      className={styles.qr}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
    >
      <path d={path} />
    </svg>
  )
}
