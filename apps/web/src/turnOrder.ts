import type { PlayerView, PublicPlayer } from '@canasta/engine'

export interface Stop {
  player: PublicPlayer
  seat: number
}

/**
 * Everyone in the order they play, starting from `firstSeat`. Play passes up the seat numbers,
 * which the rules call passing to the left.
 */
export function playOrder(players: readonly PublicPlayer[], firstSeat: number): Stop[] {
  const n = players.length
  return players.map((_, i) => {
    const seat = (((firstSeat + i) % n) + n) % n
    return { player: players[seat], seat }
  })
}

/** The line under your name: whose turn it is, and when yours comes. */
export function turnText(view: PlayerView, yourTurn: boolean): string {
  if (view.status === 'roundOver') return 'Round over'
  if (view.status === 'gameOver') return 'Game over'
  const round = view.round!
  if (yourTurn) {
    return round.phase === 'draw'
      ? 'Your turn: draw or pick up the pile'
      : 'Your turn: meld, then discard'
  }
  const n = view.players.length
  const current = view.players[round.current]
  const yourSeat = view.players.findIndex((p) => p.id === view.you?.id)
  const before = view.players[(yourSeat - 1 + n) % n]
  if (!current || !before) return 'Waiting…'
  if (before.id === current.id) return `${current.name} is playing. You're up next.`
  return `${current.name} is playing. You're up after ${before.name}.`
}
