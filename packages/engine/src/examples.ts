import type { Card, Rank, Suit } from './cards'
import type { RuleErrorCode, RuleSection } from './errors'
import type { PileState } from './pileRules'
import type { MeldBatch, Meld, Player, ScoreBreakdown } from './types'

/**
 * Worked examples for the rules page. Each one states the result the engine must give, and
 * `test/examples.test.ts` checks every example against `meldRules`, `pileRules` and `scoring`.
 * Cards are written as codes: 'Kh' is the king of hearts, '10s' the ten of spades, 'JK' a joker.
 */
interface ExampleBase {
  id: string
  section: RuleSection
  title: string
  caption: string
}

export interface MeldExample extends ExampleBase {
  kind: 'meld'
  /** An existing meld that `cards` are added to. Omit for a new meld. */
  existing?: string
  cards: string
  expected: RuleErrorCode | null
  /** What the meld is after the play, when the play is legal. */
  canasta?: 'clean' | 'dirty' | null
}

export interface PickupExample extends ExampleBase {
  kind: 'pickup'
  top: string
  /** The cards from hand that go into the play with the top discard. */
  hand: string
  /** Other cards the player keeps in hand. Defaults to a few low cards, as in a real hand. */
  rest?: string
  /** The player's score at the start of the round, which sets the initial meld minimum. */
  score: number
  /** Cards in the discard pile, including the top card. */
  pileSize: number
  /** The player's melds before the pickup. */
  melds: string[]
  hasPickedUpPile: boolean
  wildInPile: boolean
  /** 'new': the top card and `hand` start a new meld. A number: they join `melds[n]`. */
  target: 'new' | number
  expected: RuleErrorCode | null
}

export interface ScoringExamplePlayer {
  name: string
  melds: string[]
  red3s: string
  hand: string
  meldedBeforeThisTurn: boolean
}

export interface ScoringExample extends ExampleBase {
  kind: 'scoring'
  players: ScoringExamplePlayer[]
  /** The name of the player who went out, or null if the stock ran out. */
  wentOut: string | null
  expected: Record<string, ScoreBreakdown>
}

export type RulesExample = MeldExample | PickupExample | ScoringExample

const SUIT_CODES: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' }

/** Builds cards from codes. Ids count up from `firstId`, so each example's cards are distinct. */
export function exampleCards(codes: string, firstId = 0): Card[] {
  const trimmed = codes.trim()
  if (trimmed === '') return []
  return trimmed.split(/\s+/).map((code, i) => {
    const id = firstId + i
    if (code === 'JK') return { id, rank: 'JOKER', suit: null }
    const suit = SUIT_CODES[code.slice(-1)]
    if (!suit) throw new Error(`Bad card code: ${code}`)
    return { id, rank: code.slice(0, -1) as Rank, suit }
  })
}

function exampleMeld(codes: string, index: number): Meld {
  const cards = exampleCards(codes, 1000 + index * 100)
  const natural = cards.find((c) => c.rank !== '2' && c.rank !== 'JOKER')
  if (!natural) throw new Error(`Example meld needs a natural card: ${codes}`)
  return { id: `x${index}`, rank: natural.rank as Meld['rank'], cards }
}

function examplePlayer(overrides: Partial<Player>): Player {
  return {
    id: 'you',
    name: 'You',
    score: 0,
    hand: [],
    melds: [],
    red3s: [],
    hasPickedUpPile: false,
    turnsThisRound: 2,
    meldedBeforeThisTurn: true,
    drawnCard: null,
    ...overrides,
  }
}

/** A meld example as engine values: the cards before the play and the cards after it. */
export function buildMeld(example: MeldExample): { before: Card[]; added: Card[]; after: Card[] } {
  const before = example.existing ? exampleCards(example.existing, 0) : []
  const added = exampleCards(example.cards, 100)
  return { before, added, after: [...before, ...added] }
}

/** Cards a pickup example's player keeps in hand when the example doesn't say. */
const DEFAULT_REST = '4c 6d 7s'

/** A pickup example as engine values, ready for `validatePlay`. */
export function buildPickup(example: PickupExample): {
  player: Player
  pile: PileState
  pileSize: number
  top: Card
  /** The cards from hand that go into the play (the player's hand also holds `rest`). */
  played: Card[]
  batch: MeldBatch
} {
  const [top] = exampleCards(example.top, 0)
  const played = exampleCards(example.hand, 100)
  const rest = exampleCards(example.rest ?? DEFAULT_REST, 200)
  const melds = example.melds.map(exampleMeld)
  const player = examplePlayer({
    hand: [...played, ...rest],
    melds,
    score: example.score,
    hasPickedUpPile: example.hasPickedUpPile,
  })
  const pile = { top, pileFrozenForAll: example.wildInPile }
  const cardIds = [top.id, ...played.map((c) => c.id)]
  const batch: MeldBatch =
    example.target === 'new'
      ? { newMelds: [cardIds], additions: [] }
      : { newMelds: [], additions: [{ meldId: melds[example.target].id, cardIds }] }
  return { player, pile, pileSize: example.pileSize, top, played, batch }
}

/** A scoring example's players as engine players; each player's id is their name. */
export function buildScoringPlayers(example: ScoringExample): Player[] {
  return example.players.map((p, i) =>
    examplePlayer({
      id: p.name,
      name: p.name,
      melds: p.melds.map((codes, j) => exampleMeld(codes, i * 10 + j)),
      red3s: exampleCards(p.red3s, 5000 + i * 100),
      hand: exampleCards(p.hand, 6000 + i * 100),
      meldedBeforeThisTurn: p.meldedBeforeThisTurn,
    }),
  )
}

export const RULES_EXAMPLES: RulesExample[] = [
  {
    kind: 'meld',
    id: 'meld-natural',
    section: 'melds',
    title: 'A natural meld',
    caption: 'Three or more cards of one rank.',
    cards: '9h 9s 9d',
    expected: null,
  },
  {
    kind: 'meld',
    id: 'meld-wilds-equal',
    section: 'melds',
    title: 'Wilds may equal the naturals',
    caption: 'Three naturals and three wilds (two Jokers and a 2) is legal.',
    cards: '9h 9s 9d JK JK 2c',
    expected: null,
  },
  {
    kind: 'meld',
    id: 'meld-too-many-wilds',
    section: 'melds',
    title: 'Too many wilds',
    caption: 'Two naturals and three wilds: 2s count as wilds too, so this is illegal.',
    cards: '9h 9s 2c 2d JK',
    expected: 'WILDS_EXCEED_NATURALS',
  },
  {
    kind: 'meld',
    id: 'meld-two-naturals',
    section: 'melds',
    title: 'At least two naturals',
    caption: 'One natural with two wilds is not a meld.',
    cards: '9h 2c JK',
    expected: 'MELD_NEEDS_TWO_NATURALS',
  },
  {
    kind: 'meld',
    id: 'meld-threes',
    section: 'melds',
    title: '3s never meld',
    caption: 'Black 3s (and Red 3s) can never be melded, even when going out.',
    cards: '3c 3s 3c',
    expected: 'THREES_NOT_MELDABLE',
  },
  {
    kind: 'meld',
    id: 'meld-canasta-goes-dirty',
    section: 'melds',
    title: 'A wild makes a clean canasta dirty',
    caption: 'Adding a 2 to a clean canasta of Kings is legal, but it now scores 300, not 500.',
    existing: 'Kh Kd Ks Kc Kh Kd Ks',
    cards: '2c',
    expected: null,
    canasta: 'dirty',
  },
  {
    kind: 'pickup',
    id: 'pickup-frozen-pair',
    section: 'pickup',
    title: 'Frozen: a natural pair takes it',
    caption:
      'You melded Kings earlier this round but have not picked up the pile yet, so it is frozen for you. A natural pair of 8s from your hand takes the 8.',
    top: '8h',
    hand: '8s 8d',
    score: 0,
    pileSize: 6,
    melds: ['Kh Kd Ks'],
    hasPickedUpPile: false,
    wildInPile: false,
    target: 'new',
    expected: null,
  },
  {
    kind: 'pickup',
    id: 'pickup-frozen-wild',
    section: 'pickup',
    title: 'Frozen: a natural and a wild is not enough',
    caption: 'While the pile is frozen for you, the pair from your hand must be natural.',
    top: '8h',
    hand: '8s JK',
    score: 0,
    pileSize: 6,
    melds: ['Kh Kd Ks'],
    hasPickedUpPile: false,
    wildInPile: false,
    target: 'new',
    expected: 'FROZEN_NEEDS_NATURAL_PAIR',
  },
  {
    kind: 'pickup',
    id: 'pickup-unfrozen-wild',
    section: 'pickup',
    title: 'Unfrozen: a natural and a wild works',
    caption:
      'You picked up the pile earlier this round and no wild is in it, so a natural plus a wild takes the 8.',
    top: '8h',
    hand: '8s JK',
    score: 0,
    pileSize: 6,
    melds: ['Kh Kd Ks Kc'],
    hasPickedUpPile: true,
    wildInPile: false,
    target: 'new',
    expected: null,
  },
  {
    kind: 'pickup',
    id: 'pickup-unfrozen-add',
    section: 'pickup',
    title: 'Unfrozen: add it to your meld',
    caption:
      'When the pile is not frozen for you, the top card can join your unfinished meld of 8s.',
    top: '8h',
    hand: '',
    score: 0,
    pileSize: 6,
    melds: ['8c 8d 8s'],
    hasPickedUpPile: true,
    wildInPile: false,
    target: 0,
    expected: null,
  },
  {
    kind: 'pickup',
    id: 'pickup-canasta',
    section: 'pickup',
    title: "A canasta can't take the pile",
    caption:
      'Your 5s are a finished canasta, so the discarded 5 cannot join them. Start a new meld of 5s from your hand instead.',
    top: '5h',
    hand: '',
    score: 0,
    pileSize: 6,
    melds: ['5c 5d 5s 5h 5c 5d 5s'],
    hasPickedUpPile: true,
    wildInPile: false,
    target: 0,
    expected: 'CANASTA_CANNOT_TAKE_PILE',
  },
  {
    kind: 'pickup',
    id: 'pickup-wild-in-pile',
    section: 'pickup',
    title: 'A wild in the pile freezes it for everyone',
    caption:
      'Even after your first pickup, a wild anywhere in the pile means you need a natural pair from your hand.',
    top: '8h',
    hand: '',
    score: 0,
    pileSize: 6,
    melds: ['8c 8d 8s'],
    hasPickedUpPile: true,
    wildInPile: true,
    target: 0,
    expected: 'FROZEN_NEEDS_NATURAL_PAIR',
  },
  {
    kind: 'pickup',
    id: 'pickup-frozen-pair-to-meld',
    section: 'pickup',
    title: 'Frozen: the pair can join your meld',
    caption:
      'The pile is frozen for you and you already have an unfinished meld of 8s. The top 8 and a natural pair of 8s from your hand go onto that meld.',
    top: '8h',
    hand: '8s 8d',
    score: 0,
    pileSize: 6,
    melds: ['8c 8d 8s'],
    hasPickedUpPile: true,
    wildInPile: true,
    target: 0,
    expected: null,
  },
  {
    kind: 'pickup',
    id: 'pickup-black-3',
    section: 'pickup',
    title: 'A Black 3 on top blocks the pile',
    caption:
      'Nobody can pick up the pile while a Black 3 or a wild is on top, whatever cards they hold.',
    top: '3s',
    hand: '8s 8d',
    score: 0,
    pileSize: 6,
    melds: ['Kh Kd Ks'],
    hasPickedUpPile: true,
    wildInPile: false,
    target: 'new',
    expected: 'PILE_BLOCKED',
  },
  {
    kind: 'pickup',
    id: 'pickup-initial-too-low',
    section: 'initial-meld',
    title: 'A pickup can be your initial meld, but only the top card counts',
    caption:
      'With a score of 0 your first meld must reach 50. The 8 you take counts toward it, but the other cards in the pile do not: 8 + 8 + 8 is only 30.',
    top: '8h',
    hand: '8s 8d',
    score: 0,
    pileSize: 9,
    melds: [],
    hasPickedUpPile: false,
    wildInPile: false,
    target: 'new',
    expected: 'INITIAL_MELD_TOO_LOW',
  },
  {
    kind: 'scoring',
    id: 'scoring-round',
    section: 'scoring',
    title: 'Scoring a round',
    caption:
      'Ann went out after melding on an earlier turn. Bob made melds but still holds cards. Cat never melded, so her Red 3 counts against her.',
    players: [
      {
        name: 'Ann',
        melds: ['Kh Kd Ks Kc Kh Kd Ks', '7h 7d 7s 7c 7h 2c JK', '9h 9d 9s'],
        red3s: '3h',
        hand: '',
        meldedBeforeThisTurn: true,
      },
      {
        name: 'Bob',
        melds: ['5h 5d 5s'],
        red3s: '3d 3h',
        hand: 'Ah 3c',
        meldedBeforeThisTurn: true,
      },
      { name: 'Cat', melds: [], red3s: '3d', hand: '4c 4d 10s', meldedBeforeThisTurn: false },
    ],
    wentOut: 'Ann',
    expected: {
      Ann: {
        meldPoints: 195,
        canastaBonus: 800,
        red3Points: 100,
        goingOutBonus: 100,
        concealedBonus: 0,
        handPenalty: 0,
        total: 1195,
      },
      Bob: {
        meldPoints: 15,
        canastaBonus: 0,
        red3Points: 200,
        goingOutBonus: 0,
        concealedBonus: 0,
        handPenalty: 25,
        total: 190,
      },
      Cat: {
        meldPoints: 0,
        canastaBonus: 0,
        red3Points: -100,
        goingOutBonus: 0,
        concealedBonus: 0,
        handPenalty: 20,
        total: -120,
      },
    },
  },
  {
    kind: 'scoring',
    id: 'scoring-concealed',
    section: 'going-out',
    title: 'Going out concealed',
    caption:
      'Dee had not melded at all this round, then picked up the pile and went out in one turn. She still earns the 200 concealed bonus.',
    players: [
      {
        name: 'Dee',
        melds: ['Qh Qd Qs Qc Qh Qd Qs', 'Ah Ad 2s'],
        red3s: '',
        hand: '',
        meldedBeforeThisTurn: false,
      },
    ],
    wentOut: 'Dee',
    expected: {
      Dee: {
        meldPoints: 130,
        canastaBonus: 500,
        red3Points: 0,
        goingOutBonus: 100,
        concealedBonus: 200,
        handPenalty: 0,
        total: 930,
      },
    },
  },
]
