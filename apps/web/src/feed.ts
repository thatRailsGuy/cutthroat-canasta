import type {
  Card,
  CompletedCanasta,
  FeedEvent,
  Played,
  PublicPlayer,
  QuitPlayer,
} from '@canasta/engine'
import { cardLabel, cardName, rankPlural } from './cards'

function playedCards(played: Played, label: (card: Card) => string): string {
  return [...played.newMelds.flat(), ...played.additions.flatMap((a) => a.cards)]
    .map(label)
    .join(label === cardLabel ? ' ' : ', ')
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
 * players who have left, so their earlier events still read correctly. `spoken` names cards in
 * words ("7 of hearts") for a screen reader, which reads suit symbols inconsistently.
 */
export function describeEvent(
  event: FeedEvent,
  players: readonly PublicPlayer[],
  quit: readonly QuitPlayer[] = [],
  { spoken = false }: { spoken?: boolean } = {},
): string {
  const label = spoken ? cardName : cardLabel
  const list = (cards: readonly Card[]) => cards.map(label).join(spoken ? ', ' : ' ')
  if (event.type === 'stockOut') return 'The stock ran out. The round is over.'
  if (event.type === 'quit') return `${event.name} quit the game`
  if (event.type === 'joined') return `${event.name} pulled up a chair and is dealt in next hand`
  const name = [...players, ...quit].find((p) => p.id === event.playerId)?.name ?? 'Someone'
  switch (event.type) {
    case 'drewStock':
      return event.red3s.length === 0
        ? `${name} drew a card`
        : `${name} drew and laid down ${list(event.red3s)}`
    case 'pickedUpPile':
      // `count` includes the top card, which went straight into a meld.
      return (
        `${name} picked up ${event.count} cards, melding ${playedCards(event.played, label)}` +
        completed(event.canastas) +
        (event.red3s?.length ? `, and laid down ${list(event.red3s)}` : '')
      )
    case 'melded':
      return `${name} melded ${playedCards(event.played, label)}${completed(event.canastas)}`
    case 'discarded':
      return `${name} discarded ${label(event.card)}`
    case 'wentOut':
      return `${name} went out`
    case 'redealt':
      return `${name} threw out the hand and dealt a new one`
  }
}
