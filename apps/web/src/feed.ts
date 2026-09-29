import type { FeedEvent, Played, PublicPlayer } from '@canasta/engine'
import { cardLabel } from './cards'

function playedCards(played: Played): string {
  return [...played.newMelds.flat(), ...played.additions.flatMap((a) => a.cards)]
    .map(cardLabel)
    .join(' ')
}

/** One line for the action feed, such as "Ann picked up 9 cards". */
export function describeEvent(event: FeedEvent, players: readonly PublicPlayer[]): string {
  if (event.type === 'stockOut') return 'The stock ran out. The round is over.'
  const name = players.find((p) => p.id === event.playerId)?.name ?? 'Someone'
  switch (event.type) {
    case 'drewStock':
      return event.red3s.length === 0
        ? `${name} drew a card`
        : `${name} drew and laid down ${event.red3s.map(cardLabel).join(' ')}`
    case 'pickedUpPile':
      // `count` includes the top card, which went straight into a meld.
      return `${name} picked up ${event.count} cards, melding ${playedCards(event.played)}`
    case 'melded':
      return `${name} melded ${playedCards(event.played)}`
    case 'discarded':
      return `${name} discarded ${cardLabel(event.card)}`
    case 'wentOut':
      return `${name} went out`
  }
}
