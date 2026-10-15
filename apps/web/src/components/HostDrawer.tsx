import type { PublicPlayer } from '@canasta/engine'
import { useEffect, useId, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { GameCode } from './GameCode'
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
  /**
   * Set when this player isn't the host but the host is away: they can stand in, and making a
   * rejoin link makes them host. The host's name is null when there is no host.
   */
  standIn?: { hostName: string | null }
  /** playerId → the newest rejoin link made for that seat. */
  links: Record<string, string>
  /** How many errors the server has sent. One that comes after a link was asked for refuses it. */
  refusals: number
  /**
   * Ask the server for a rejoin link. Offered for every seat, because a dead phone can still
   * count as connected: the server checks for silent sockets every 30 seconds, and whenever a
   * message arrives, so the reissue request itself is a check. Returns false, like `send`, if
   * it couldn't be sent.
   */
  onReissue: (playerId: string) => boolean
  onRedeal: () => void
}

/**
 * The host's tools in a slide-over panel, like the rules: invite another player, throw out the
 * hand and deal again, and make a rejoin link for a seat that needs one. A player standing in
 * for an away host gets the same panel without the new hand, until they are host.
 *
 * A new rejoin link opens as a ticket in its seat's row, with a QR code. While a ticket is open,
 * the invite's QR code folds away, so only one QR code is on screen and nobody scans the invite
 * by mistake: it opens the join form and takes a new seat.
 */
export function HostDrawer(props: HostDrawerProps) {
  const { open, onClose, code, seats, waiting, full, playing, offline, connected, links, standIn } =
    props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [confirmRedeal, setConfirmRedeal] = useState(false)
  /**
   * What takes focus once it renders, as the button that was pressed goes away: the ticket that
   * opened, the Show QR button of the ticket that closed, the invite that unfolded, or Deal a
   * new hand as its confirm closes. With `ifLost`, the server caused the change, so it takes
   * focus only if focus went with the element that left, not if the host has moved on.
   */
  const [focusNext, setFocusNext] = useState<{ key: string; ifLost?: boolean } | null>(null)
  const focusOnMount = (key: string) => (el: HTMLElement | null) => {
    if (!el || focusNext?.key !== key) return
    setFocusNext(null)
    const active = document.activeElement
    if (!focusNext.ifLost || !active || active === document.body) el.focus()
  }
  const cancelRedeal = () => {
    setFocusNext({ key: 'redeal' })
    setConfirmRedeal(false)
  }
  const invite = `${window.location.origin}/g/${code}`
  const seated = (playerId: string) => seats.some((s) => s.player.id === playerId)
  // The seat whose ticket is open, and the seat whose link was asked for and hasn't come yet,
  // with the server's error count then.
  const [ticket, setTicket] = useState<string | null>(null)
  const [asked, setAsked] = useState<{ playerId: string; refusals: number } | null>(null)
  if (asked) {
    if (props.refusals !== asked.refusals || !seated(asked.playerId)) {
      // The server refused, or the player is gone: no link is coming.
      setAsked(null)
    } else if (links[asked.playerId]) {
      // The link has come: its ticket opens, and closes any other.
      setAsked(null)
      setTicket(asked.playerId)
      setFocusNext({ key: `ticket-${asked.playerId}`, ifLost: true })
    }
  }
  if (ticket && !seated(ticket)) {
    // The ticket's player quit or was kicked, so their link is dead: the invite unfolds.
    setTicket(null)
    setFocusNext({ key: 'invite', ifLost: true })
  }
  const shown = ticket && links[ticket] && seated(ticket) ? ticket : null
  const shownName = seats.find((s) => s.player.id === shown)?.player.name
  const showTicket = (playerId: string) => {
    // Opening a ticket by hand means a link still on its way doesn't open over it.
    setAsked(null)
    setFocusNext({ key: `ticket-${playerId}` })
    setTicket(playerId)
  }
  /** Closes the ticket. `focusKey` is what takes focus, as the button pressed goes away. */
  const hideTicket = (focusKey: string) => {
    setFocusNext({ key: focusKey })
    setTicket(null)
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const close = () => {
    setConfirmRedeal(false)
    // A rejoin QR code is private, so it doesn't open again with the drawer.
    setTicket(null)
    setAsked(null)
    setFocusNext(null)
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
          <h2 id="host-tools">{standIn ? 'Stand in for the host' : 'Host tools'}</h2>
          <button type="button" onClick={close}>
            Close
          </button>
        </header>
        {open && (
          <>
            {standIn && (
              <p className={styles.standIn}>
                {standIn.hostName
                  ? `${standIn.hostName} is the host, but they're away.`
                  : 'The host is away.'}{' '}
                If you make a rejoin link, you become the host, so the game can go on. Everyone sees
                that you did.
              </p>
            )}
            <section className={styles.section} aria-labelledby="host-invite">
              {full ? (
                <>
                  <h3 id="host-invite">Invite a player</h3>
                  <p>The table is full.</p>
                </>
              ) : shown ? (
                <>
                  <div className={styles.folded}>
                    <h3 id="host-invite">Invite a player</h3>
                    <button type="button" onClick={() => hideTicket('invite')}>
                      Show invite
                    </button>
                  </div>
                  <p className={styles.note}>
                    Folded away while {shownName}'s rejoin QR is up, so nobody scans the wrong code.
                    The invite link opens the join form and takes a new seat.
                  </p>
                </>
              ) : (
                <>
                  {/* Takes focus when Show invite unfolds it, as that button goes away. */}
                  <h3 id="host-invite" tabIndex={-1} ref={focusOnMount('invite')}>
                    Invite a player
                  </h3>
                  <p>Anyone who joins now sits out this hand and is dealt in with the next one.</p>
                  <GameCode code={code} small />
                  <CopyField value={invite} label="Invite link" />
                  <QrCode text={invite} label="QR code for the invite link" />
                  <p className={styles.caption}>For a new player: takes a new seat</p>
                </>
              )}
              {waiting.length > 0 && (
                <p className={styles.waiting}>
                  Dealt in next hand: {waiting.map((p) => p.name).join(', ')}
                </p>
              )}
            </section>

            {playing && !standIn && (
              <section className={styles.section} aria-labelledby="host-new-hand">
                <h3 id="host-new-hand">New hand</h3>
                <p>
                  Throw out this hand and deal a new one. Every hand and meld goes back in the deck,
                  and nobody scores this hand.
                </p>
                {confirmRedeal ? (
                  <div
                    className={styles.confirm}
                    role="alertdialog"
                    aria-label="Deal a new hand?"
                    onKeyDown={(e) => {
                      // Escape backs out of the confirm, not out of the whole drawer.
                      if (e.key !== 'Escape') return
                      e.preventDefault()
                      e.stopPropagation()
                      cancelRedeal()
                    }}
                  >
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
                    {/* The safe choice takes focus, so a stray Enter doesn't throw out the hand. */}
                    <button type="button" autoFocus onClick={cancelRedeal}>
                      Keep playing
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    ref={focusOnMount('redeal')}
                    onClick={() => setConfirmRedeal(true)}
                  >
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
                        {/* The dot already says Offline to a screen reader. */}
                        {!isConnected && (
                          <span className={styles.away} aria-hidden="true">
                            away
                          </span>
                        )}
                      </span>
                      {shown === player.id ? (
                        <RejoinTicket
                          name={player.name}
                          seat={seat}
                          link={links[player.id]}
                          onHide={() => hideTicket(`show-${player.id}`)}
                          ticketRef={focusOnMount(`ticket-${player.id}`)}
                        />
                      ) : (
                        // A new link remounts the control, which clears the last copy result.
                        <RejoinControl
                          key={links[player.id]}
                          name={player.name}
                          onReissue={() => {
                            // Offline, nothing went, so no link is coming.
                            if (props.onReissue(player.id)) {
                              setAsked({ playerId: player.id, refusals: props.refusals })
                            }
                          }}
                          onShow={() => showTicket(player.id)}
                          showRef={focusOnMount(`show-${player.id}`)}
                          link={links[player.id]}
                          subtle={isConnected}
                        />
                      )}
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
  /** Opens the seat's ticket again, once its link is made. */
  onShow: () => void
  /** Gets the Show QR button, so it can take focus back as the ticket closes. */
  showRef?: (el: HTMLButtonElement | null) => void
  link?: string
  /**
   * The player still counts as connected: offer a quieter, dashed button. If they really are
   * live, the server refuses with PLAYER_CONNECTED, which shows as a toast.
   */
  subtle?: boolean
}

export function RejoinControl({
  name,
  onReissue,
  onShow,
  showRef,
  link,
  subtle = false,
}: RejoinControlProps) {
  if (link) {
    return (
      <div className={styles.linkRow}>
        <CopyField value={link} label={`${name}'s rejoin link`} />
        <button type="button" ref={showRef} aria-label={`Show QR for ${name}`} onClick={onShow}>
          Show QR
        </button>
      </div>
    )
  }
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

export interface RejoinTicketProps {
  name: string
  /** Seat number, for the avatar colour. */
  seat: number
  link: string
  onHide: () => void
  /** Gets the ticket, so it can take focus as it opens. */
  ticketRef?: (el: HTMLDivElement | null) => void
}

/**
 * A rejoin link's ticket: the seat's QR code in a dashed red frame, with the seat's avatar on its
 * corner, under an ink band. The band is ink for every seat colour, so its text always has the
 * contrast.
 * The privacy line repeats the name: the game doesn't know anyone's pronouns.
 */
export function RejoinTicket({ name, seat, link, onHide, ticketRef }: RejoinTicketProps) {
  const id = useId()
  return (
    <div
      ref={ticketRef}
      className={styles.ticket}
      role="group"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
    >
      <div className={styles.band}>
        <div>
          <h4 id={`${id}-title`}>Rejoin link for {name}</h4>
          <p>Opens {name}'s seat and hand</p>
        </div>
      </div>
      <div className={styles.ticketBody}>
        <div className={styles.qrFrame}>
          <span className={styles.badge}>
            <Avatar name={name} seat={seat} />
          </span>
          <QrCode text={link} label={`QR code for ${name}'s rejoin link`} />
          {/* The QR code's name already says whose seat it opens. */}
          <span className={styles.tab} aria-hidden="true">
            {name}'s seat
          </span>
        </div>
        <p className={styles.private}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span>
            <strong>Private.</strong> Whoever scans this plays as {name} and sees {name}'s hand.
            Show it only to {name}.
          </span>
        </p>
        <CopyField value={link} label={`${name}'s rejoin link`} showLabel />
        <button type="button" onClick={onHide}>
          Hide QR
        </button>
      </div>
    </div>
  )
}

/** A link in a read-only box with a Copy button. With showLabel, its label shows above it. */
function CopyField({
  value,
  label,
  showLabel = false,
}: {
  value: string
  label: string
  showLabel?: boolean
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [copyResult, setCopyResult] = useState<'copied' | 'manual' | null>(null)
  /**
   * The Clipboard API exists only in secure contexts, so it is missing over plain http on a LAN.
   * Then the old copy command copies the selected link, and if even that fails, the link stays
   * selected for the host to copy by hand.
   */
  const copy = () => {
    const fallback = () => {
      const input = inputRef.current
      let copied = false
      if (input) {
        input.focus()
        // iOS Safari doesn't select a read-only box's text with select(), and then the copy
        // command copies nothing while still saying it worked. setSelectionRange works there.
        input.readOnly = false
        input.setSelectionRange(0, input.value.length)
        input.readOnly = true
        const selected = input.selectionStart === 0 && input.selectionEnd === input.value.length
        try {
          copied = selected && document.execCommand('copy')
        } catch {
          // Some browsers throw instead of returning false.
        }
      }
      setCopyResult(copied ? 'copied' : 'manual')
    }
    if (!navigator.clipboard) return fallback()
    navigator.clipboard
      .writeText(value)
      .then(() => setCopyResult('copied'))
      .catch(fallback)
  }
  return (
    <div className={styles.copy}>
      {showLabel && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        readOnly
        value={value}
        aria-label={showLabel ? undefined : label}
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
