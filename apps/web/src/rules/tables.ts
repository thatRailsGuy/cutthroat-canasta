import {
  CARD_VALUES,
  INITIAL_MELD_TIERS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  deckCount,
  handSize,
  type Rank,
} from '@canasta/engine'

const NATURAL_RANKS: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4']
const fmt = (n: number) => n.toLocaleString('en-US')

export interface ValueRow {
  cards: string
  role: string
  points: number
}

/** Card values, straight from CARD_VALUES. Naturals with equal values share a row. */
export function cardValueRows(): ValueRow[] {
  const naturals: ValueRow[] = []
  for (const rank of NATURAL_RANKS) {
    const last = naturals.at(-1)
    if (last && last.points === CARD_VALUES[rank]) last.cards += `, ${rank}`
    else naturals.push({ cards: rank, role: 'Natural', points: CARD_VALUES[rank] })
  }
  return [
    { cards: 'Joker', role: 'Wild', points: CARD_VALUES.JOKER },
    { cards: '2', role: 'Wild', points: CARD_VALUES['2'] },
    ...naturals,
    { cards: 'Black 3', role: 'Stop card, never meldable', points: CARD_VALUES['3'] },
  ]
}

/** Initial meld minimums from INITIAL_MELD_TIERS. Scores are always multiples of 5. */
export function initialMeldRows(): { score: string; minimum: number }[] {
  return INITIAL_MELD_TIERS.map((tier, i) => {
    const from = INITIAL_MELD_TIERS[i - 1]?.below
    const score =
      from === undefined || from === null
        ? `Below ${fmt(tier.below ?? 0)}`
        : tier.below === null
          ? `${fmt(from)} or more`
          : `${fmt(from)} – ${fmt(tier.below - 5)}`
    return { score, minimum: tier.minimum }
  })
}

/** Decks and hand size for each player count, from deckCount and handSize. */
export function tableSizeRows(): { players: string; decks: number; hand: number }[] {
  const rows: { from: number; to: number; decks: number; hand: number }[] = []
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    const last = rows.at(-1)
    if (last && last.decks === deckCount(n) && last.hand === handSize(n)) last.to = n
    else rows.push({ from: n, to: n, decks: deckCount(n), hand: handSize(n) })
  }
  return rows.map((r) => ({
    players: r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`,
    decks: r.decks,
    hand: r.hand,
  }))
}
