import type { PublicPlayer } from '@canasta/engine'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import styles from './HostDrawer.module.css'
import { QrCode } from './QrCode'

export interface HostDrawerProps {
  open: boolean
  onClose: () => void
  code: string
  /** Everyone but the host, each with their seat number for the avatar colour. */
  seats: { player: PublicPlayer; seat: number }[]
  /** Players who joined mid-game and are dealt in with the next hand. */
  waiting: { id: string; name: string }[]
  /** No room for anyone else. */
  full: boolean
  /** A hand is being played, so it can be thrown out. */
  playing: boolean
  offline: boolean
  connected: readonly string[]
  /** playerId → the newest rejoin link made for that seat. */
  links: Record<string, string>
  /**
   * Ask the server for a rejoin link. Offered for every seat, because a dead phone can still
   * count as connected: the server only notices a silent socket when a message arrives, and the
   * reissue request itself is that message.
   */
  onReissue: (playerId: string) => void
  onRedeal: () => void
}

/**
 * The host's tools in a slide-over panel, like the rules: invite another player, throw out the
 * hand and deal again, and make a rejoin link for a seat that needs one.
 */
export function HostDrawer(props: HostDrawerProps) {
  const { open, onClose, code, seats, waiting, full, playing, offline, connected, links } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [confirmRedeal, setConfirmRedeal] = useState(false)
  const invite = `${window.location.origin}/g/${code}`

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const close = () => {
    setConfirmRedeal(false)
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.drawer}
      onClose={close}
      onClick={(e) => {
        // A click on the dialog itself, not its contents, landed on the dimmed table behind it.
        if (e.target === e.currentTarget) close()
      }}
      aria-labelledby="host-tools"
    >
      <div className={styles.body}>
        <header className={styles.head}>
          <h2 id="host-tools">Host tools</h2>
          <button type="button" onClick={close}>
            Close
          </button>
        </header>
        {open && (
          <>
            <section className={styles.section} aria-labelledby="host-invite">
              <h3 id="host-invite">Invite a player</h3>
              {full ? (
                <p>The table is full.</p>
              ) : (
                <>
                  <p>Anyone who joins now sits out this hand and is dealt in with the next one.</p>
                  <CopyField value={invite} label="Invite link" />
                  <QrCode text={invite} label={`QR code for ${invite}`} />
                </>
              )}
              {waiting.length > 0 && (
                <p className={styles.waiting}>
                  Dealt in next hand: {waiting.map((p) => p.name).join(', ')}
                </p>
              )}
            </section>

            {playing && (
              <section className={styles.section} aria-labelledby="host-new-hand">
                <h3 id="host-new-hand">New hand</h3>
                <p>
                  Throw out this hand and deal a new one. Every hand and meld goes back in the deck,
                  and nobody scores this hand.
                </p>
                {confirmRedeal ? (
                  <div className={styles.confirm} role="alertdialog" aria-label="Deal a new hand?">
                    <span>Sure? This can't be undone.</span>
                    <button
                      type="button"
                      className={styles.danger}
                      disabled={offline}
                      onClick={() => {
                        props.onRedeal()
                        close()
                      }}
                    >
                      Deal new hand
                    </button>
                    <button type="button" onClick={() => setConfirmRedeal(false)}>
                      Keep playing
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmRedeal(true)}>
                    Deal a new hand…
                  </button>
                )}
              </section>
            )}

            <section className={styles.section} aria-labelledby="host-rejoin">
              <h3 id="host-rejoin">Rejoin links</h3>
              <p>For a player whose phone died or who can't get back to their seat.</p>
              <ul className={styles.seats}>
                {seats.map(({ player, seat }) => {
                  const isConnected = connected.includes(player.id)
                  return (
                    <li key={player.id}>
                      <span className={styles.seat}>
                        <Avatar name={player.name} seat={seat} small />
                        <strong>{player.name}</strong>
                        <span
                          className={isConnected ? styles.online : styles.offline}
                          role="img"
                          aria-label={isConnected ? 'Online' : 'Offline'}
                          title={isConnected ? 'Online' : 'Offline'}
                        />
                      </span>
                      {/* A new link remounts the control, which clears the last copy result. */}
                      <RejoinControl
                        key={links[player.id]}
                        name={player.name}
                        onReissue={() => props.onReissue(player.id)}
                        link={links[player.id]}
                        subtle={isConnected}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </dialog>
  )
}

export interface RejoinControlProps {
  /** The seat's player, for the button's accessible name. */
  name: string
  onReissue: () => void
  link?: string
  /**
   * The player still counts as connected: offer a quieter, dashed button. If they really are
   * live, the server refuses with PLAYER_CONNECTED, which shows as a toast.
   */
  subtle?: boolean
}

export function RejoinControl({ name, onReissue, link, subtle = false }: RejoinControlProps) {
  if (link) return <CopyField value={link} label={`Rejoin link for ${name}`} />
  return (
    <button
      type="button"
      className={subtle ? styles.stuck : undefined}
      aria-label={`${subtle ? 'Seat stuck? ' : ''}Make a rejoin link for ${name}`}
      onClick={onReissue}
    >
      Rejoin link
    </button>
  )
}

/** A link in a read-only box with a Copy button. */
function CopyField({ value, label }: { value: string; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [copyResult, setCopyResult] = useState<'copied' | 'manual' | null>(null)
  /**
   * The Clipboard API exists only in secure contexts, so it is missing over plain http on a LAN.
   * Then the link is selected for the host to copy by hand.
   */
  const copy = () => {
    const manual = () => {
      setCopyResult('manual')
      inputRef.current?.select()
    }
    if (!navigator.clipboard) return manual()
    navigator.clipboard
      .writeText(value)
      .then(() => setCopyResult('copied'))
      .catch(manual)
  }
  return (
    <div className={styles.copy}>
      <input
        ref={inputRef}
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" onClick={copy}>
        Copy
      </button>
      <span role="status">
        {copyResult === 'copied' ? 'Copied' : copyResult === 'manual' ? 'Select and copy' : ''}
      </span>
    </div>
  )
}
