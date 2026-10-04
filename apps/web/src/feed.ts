import type { CompletedCanasta, FeedEvent, Played, PublicPlayer, QuitPlayer } from '@canasta/engine'
import { cardLabel, rankPlural } from './cards'

function playedCards(played: Played): string {
  return [...played.newMelds.flat(), ...played.additions.flatMap((a) => a.cards)]
    .map(cardLabel)
    .join(' ')
}

/** ", completing a clean canasta of Queens", or nothing. */
function completed(canastas: readonly CompletedCanasta[] | undefined): string {
  if (!canastas || canastas.length === 0) return ''
  const list = canastas.map(
    (c) => `a ${c.natural ? 'clean' : 'dirty'} canasta of ${rankPlural(c.rank)}`,
  )
  return `, completing ${list.join(' and ')}`
}

/**
 * One line for the action feed, such as "Ann picked up 9 cards". `quit` supplies the names of
 * players who have left, so their earlier events still read correctly.
 */
export function describeEvent(
  event: FeedEvent,
  players: readonly PublicPlayer[],
  quit: readonly QuitPlayer[] = [],
): string {
  if (event.type === 'stockOut') return 'The stock ran out. The round is over.'
  if (event.type === 'quit') return `${event.name} quit the game`
  if (event.type === 'joined') return `${event.name} pulled up a chair and is dealt in next hand`
  const name = [...players, ...quit].find((p) => p.id === event.playerId)?.name ?? 'Someone'
  switch (event.type) {
    case 'drewStock':
      return event.red3s.length === 0
        ? `${name} drew a card`
        : `${name} drew and laid down ${event.red3s.map(cardLabel).join(' ')}`
    case 'pickedUpPile':
      // `count` includes the top card, which went straight into a meld.
      return (
        `${name} picked up ${event.count} cards, melding ${playedCards(event.played)}` +
        completed(event.canastas) +
        (event.red3s?.length ? `, and laid down ${event.red3s.map(cardLabel).join(' ')}` : '')
      )
    case 'melded':
      return `${name} melded ${playedCards(event.played)}${completed(event.canastas)}`
    case 'discarded':
      return `${name} discarded ${cardLabel(event.card)}`
    case 'wentOut':
      return `${name} went out`
    case 'redealt':
      return `${name} threw out the hand and dealt a new one`
  }
}
