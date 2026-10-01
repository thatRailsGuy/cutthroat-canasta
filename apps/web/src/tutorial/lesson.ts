import {
  addPlayer,
  applyAction,
  createGame,
  isCanasta,
  startGame,
  type Action,
  type Card,
  type Game,
  type MeldBatch,
  type Player,
  type Rank,
  type Suit,
} from '@canasta/engine'

/**
 * The practice hand: one round against Dot, on a stacked deck, so each step of the lesson has
 * the cards it needs. The engine plays it for real; the lesson only chooses the cards, refuses
 * moves that would leave the script, and plays Dot's turns.
 */

export const YOU = 'you'
export const DOT = 'dot'

const SUITS: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' }

const YOUR_HAND = [
  'As',
  'Ah',
  'Ad',
  'Ac',
  'As',
  '9s',
  '9c',
  'Ks',
  'Kd',
  'Kc',
  '7s',
  '7d',
  '7c',
  '2h',
  '4c',
]
const DOT_HAND = [
  'Qs',
  'Qh',
  'Qd',
  'JK',
  '9d',
  '6c',
  '8s',
  '8h',
  'Jc',
  '10d',
  '10h',
  '5h',
  '6s',
  '4d',
  '7h',
]
const UPCARD = '5s'
/** Drawn in this order: your first draw, Dot's two draws, then your last draw. */
const DRAWS = ['Ah', 'Jd', '5d', 'Kh']
/** What Dot discards on her first and second turns. */
const DOT_DISCARDS = ['9d', '6c']
const DOT_MELD = ['Qs', 'Qh', 'Qd', 'JK']

/** 'Kh' → king of hearts, 'JK' → joker. */
function matches(card: Card, code: string): boolean {
  if (code === 'JK') return card.rank === 'JOKER'
  return card.rank === (code.slice(0, -1) as Rank) && card.suit === SUITS[code.slice(-1)]
}

/** A two-player game where you sit second, so you play first, with the lesson's cards dealt. */
export function lessonGame(): Game {
  let game = createGame([7, 1, 19, 52])
  for (const [id, name] of [
    [DOT, 'Dot'],
    [YOU, 'You'],
  ]) {
    game = expectOk(addPlayer(game, id, name))
  }
  game = expectOk(startGame(game))

  const round = game.round!
  const pool = [
    ...round.stock,
    ...round.discard,
    ...game.players.flatMap((p) => [...p.hand, ...p.red3s]),
  ]
  const take = (code: string) => {
    const i = pool.findIndex((c) => matches(c, code))
    if (i === -1) throw new Error(`No ${code} left to deal`)
    return pool.splice(i, 1)[0]
  }

  for (const player of game.players) {
    player.hand = (player.id === YOU ? YOUR_HAND : DOT_HAND).map(take)
    player.red3s = []
  }
  round.discard = [take(UPCARD)]
  round.pileFrozenForAll = false
  round.frozenBy = null
  const draws = DRAWS.map(take)
  // Keep Red 3s out of the stock, so no draw brings one into the script.
  const rest = pool.filter(
    (c) => !(c.rank === '3' && (c.suit === 'hearts' || c.suit === 'diamonds')),
  )
  // The top of the stock is the end of the array.
  round.stock = [...rest, ...draws.reverse()]
  return game
}

function expectOk(result: ReturnType<typeof addPlayer>): Game {
  if (!result.ok) throw new Error(result.error.message)
  return result.game
}

export function player(game: Game, id: string): Player {
  return game.players.find((p) => p.id === id)!
}

export function isTurnOf(game: Game, id: string): boolean {
  return game.status === 'playing' && game.players[game.round!.current]?.id === id
}

/** Dot's next move, or null when it isn't her turn. */
export function dotMove(game: Game): Action | null {
  if (!isTurnOf(game, DOT)) return null
  const dot = player(game, DOT)
  if (game.round!.phase === 'draw') return { type: 'drawStock' }
  if (dot.melds.length === 0) {
    const cardIds = DOT_MELD.map((code) => dot.hand.find((c) => matches(c, code))?.id)
    if (cardIds.every((id) => id !== undefined)) {
      return { type: 'meld', play: { newMelds: [cardIds], additions: [] } }
    }
  }
  const planned = DOT_DISCARDS[dot.turnsThisRound - 1]
  const card = dot.hand.find((c) => planned !== undefined && matches(c, planned)) ?? dot.hand[0]
  return { type: 'discard', cardId: card.id }
}

export function playDot(game: Game): Game {
  const action = dotMove(game)
  if (!action) return game
  const result = applyAction(game, DOT, action)
  return result.ok ? result.game : game
}

export interface Step {
  title: string
  body: string
  /** The step is over once this holds. Steps without it wait for the Next button. */
  done?: (game: Game) => boolean
  /**
   * Returns why a move of yours is not part of this step, or null to let the engine judge it.
   * Without it, every move waits.
   */
  allow?: (action: Action, game: Game) => string | null
  /** Dot is playing: the step moves on by itself. */
  waiting?: boolean
}

function cardsOf(action: Action, game: Game): Card[] {
  const play: MeldBatch | null =
    action.type === 'meld' || action.type === 'pickUpPile' ? action.play : null
  if (!play) return []
  const ids = [...play.newMelds.flat(), ...play.additions.flatMap((a) => a.cardIds)]
  const you = player(game, YOU)
  const top = game.round!.discard.at(-1)
  return ids.flatMap((id) => [...you.hand, ...(top ? [top] : [])].filter((c) => c.id === id))
}

function discarding(action: Action, game: Game): Card | undefined {
  return action.type === 'discard'
    ? player(game, YOU).hand.find((c) => c.id === action.cardId)
    : undefined
}

const turn = (game: Game) => player(game, YOU).turnsThisRound
const yourPlay = (game: Game, n: number) =>
  turn(game) === n && isTurnOf(game, YOU) && game.round!.phase === 'play'
const passed = (game: Game, n: number) => turn(game) > n || !isTurnOf(game, YOU)

export const STEPS: Step[] = [
  {
    title: 'Welcome to the table',
    body: 'This practice hand teaches you one round against Dot. You make melds: three or more cards of one rank. A meld of seven cards is a canasta, and canastas score big. The game ends after the round in which someone reaches 5,000 points, and the highest total wins.',
  },
  {
    title: 'Find your way around',
    body: "Your hand is at the bottom, sorted by rank. The stock and the discard pile are in the middle. Dot's cards and melds are at the top. The score pad and the feed of every move are on the right.",
  },
  {
    title: 'Draw a card',
    body: 'Every turn starts with a draw. Click the stock (the face-down pile) to draw its top card.',
    done: (g) => yourPlay(g, 1),
    allow: (a) => (a.type === 'drawStock' ? null : 'Start by drawing from the stock.'),
  },
  {
    title: 'Make your first meld',
    body: 'Your first meld of a round must be worth 50 points or more. That is the number next to your score. Aces are worth 20 points each. Click three or more aces in your hand, then click Meld.',
    done: (g) => player(g, YOU).melds.length > 0,
    allow: (a, g) => {
      if (a.type !== 'meld') return 'Meld your aces first.'
      return cardsOf(a, g).every((c) => c.rank === 'A') ? null : 'For this lesson, meld only aces.'
    },
  },
  {
    title: 'Discard to end your turn',
    body: "Every turn ends with a discard. Click the 4♣, then click Discard. Dot can take the pile with the card you throw away, so throw away cards she can't use.",
    done: (g) => passed(g, 1),
    allow: (a, g) => {
      if (a.type === 'meld') {
        return cardsOf(a, g).every((c) => c.rank === 'A') ? null : 'For this lesson, keep those.'
      }
      return discarding(a, g) && matches(discarding(a, g)!, '4c')
        ? null
        : 'For this lesson, discard the 4♣.'
    },
  },
  {
    title: "Dot's turn",
    body: 'Watch the feed on the right. Dot draws, melds her queens with a joker (a wild card), and discards.',
    waiting: true,
    done: (g) => isTurnOf(g, YOU),
  },
  {
    title: 'Pick up the pile',
    body: "Dot discarded the 9♦, and you hold two 9s. Until you pick it up once, the pile is frozen for you: you can take it only with a natural pair (no wilds) of the top card's rank. Click the 9♦ on the pile, then click Pick up pile. The 9s make a meld, and the rest of the pile goes into your hand.",
    done: (g) => player(g, YOU).hasPickedUpPile,
    allow: (a) => (a.type === 'pickUpPile' ? null : 'Take the pile with your two 9s.'),
  },
  {
    title: 'Make a canasta',
    body: 'Seven cards make a canasta. Click your other aces and the 2♥, then click Meld. They go onto your aces. 2s and jokers are wild: a canasta with a wild in it is mixed (300 points), and one with no wilds is clean (500 points).',
    done: (g) => player(g, YOU).melds.some(isCanasta),
    allow: (a, g) => {
      if (a.type !== 'meld') return 'Finish the canasta of aces first.'
      return cardsOf(a, g).every((c) => c.rank === 'A' || matches(c, '2h'))
        ? null
        : 'Put your aces and the 2♥ on your aces.'
    },
  },
  {
    title: 'Discard again',
    body: 'Discard the 5♠ or the 4♣ to end your turn. Keep the kings and the 7s for later.',
    done: (g) => passed(g, 2),
    allow: (a, g) => {
      if (a.type === 'meld') return null
      const card = discarding(a, g)
      return card && (matches(card, '5s') || matches(card, '4c'))
        ? null
        : 'Discard the 5♠ or the 4♣.'
    },
  },
  {
    title: "Dot's turn",
    body: 'Dot draws and discards. She is holding a lot of cards, and every card left in her hand when the round ends counts against her.',
    waiting: true,
    done: (g) => isTurnOf(g, YOU),
  },
  {
    title: 'Go out',
    body: 'Now that you have a canasta, you may go out: play every card from your hand, and the round ends. Draw from the stock. Then meld your kings, meld your 7s, and discard your last card. Going out earns 100 points.',
    done: (g) => g.status !== 'playing',
    allow: (a, g) => {
      if (a.type === 'pickUpPile') return 'Draw from the stock.'
      if (a.type === 'discard' && player(g, YOU).hand.length > 1) {
        return 'Meld your kings and your 7s first, so your discard is your last card.'
      }
      return null
    },
  },
  {
    title: 'You went out!',
    body: 'The round is scored. You get points for every card in your melds, plus your canasta bonus and the bonus for going out. Dot loses the points of the cards left in her hand. A real game deals new hands each round, until a round ends with someone at 5,000 or more.',
  },
]

/** Moves past the steps whose goal the game already meets. */
export function advance(step: number, game: Game): number {
  let next = step
  while (STEPS[next]?.done?.(game)) next++
  return next
}
