import type { PlayerView } from '@canasta/engine'
import type { ChatLine } from '@canasta/server/protocol'
import { describeEvent } from './feed'

/**
 * What a screen reader should hear when the view changes from `prev` to `next`: other players'
 * moves (only with `events`, where the table's own event log isn't on screen), then the turn
 * coming to you, the round ending or the game ending.
 */
export function announcements(
  prev: PlayerView | null,
  next: PlayerView,
  playerId: string | null,
  { events }: { events: boolean },
): string[] {
  if (!prev) return []
  const out: string[] = []
  const prevRound = prev.round
  const round = next.round
  const sameDeal =
    prevRound !== null &&
    round !== null &&
    prev.gameNumber === next.gameNumber &&
    prevRound.number === round.number &&
    prevRound.redeals === round.redeals
  if (events && sameDeal) {
    for (const event of round.feed.slice(prevRound.feed.length)) {
      if ('playerId' in event && event.playerId === playerId) continue
      out.push(describeEvent(event, next.players, next.quit, { spoken: true }))
    }
  }
  if (yourTurn(next, playerId) && !(sameDeal && yourTurn(prev, playerId))) out.push('Your turn.')
  if (next.status === 'roundOver' && prev.status !== 'roundOver' && round) {
    out.push(`Round ${round.number} is over.`)
  }
  if (next.status === 'gameOver' && prev.status !== 'gameOver') out.push(gameOverText(next))
  return out
}

/** A chat line someone else sent, as a screen reader should hear it. */
export function chatAnnouncement(line: ChatLine, playerId: string | null): string | null {
  return line.playerId === playerId ? null : `${line.name} says: ${line.text}`
}

function yourTurn(view: PlayerView, playerId: string | null): boolean {
  const round = view.round
  return (
    view.status === 'playing' &&
    round !== null &&
    playerId !== null &&
    view.players[round.current]?.id === playerId
  )
}

function gameOverText(view: PlayerView): string {
  const names = view.winners.map((id) => view.players.find((p) => p.id === id)?.name ?? '?')
  if (names.length === 0) return 'Game over.'
  return names.length > 1
    ? `Game over. ${names.join(' and ')} share the win.`
    : `Game over. ${names[0]} wins.`
}
