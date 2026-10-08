import type { FeedEvent, GameStatus, PlayerView } from '@canasta/engine'
import { MAX_ANIMATED_EVENTS } from './effects'

/** How much you hear, from the sound button's slider. Each step adds to the one before. */
export type SoundLevel = 0 | 1 | 2 | 3

export const SOUND_LEVELS: readonly { name: string; hint: string }[] = [
  { name: 'Off', hint: 'No sound at all. Everything still shows on screen.' },
  {
    name: 'Turn alert',
    hint: 'A bell when it’s your turn, and at the end of a round or game. Good for a table full of phones.',
  },
  {
    name: 'My plays',
    hint: 'Your turn bell, plus sounds for your own draws, melds, discards and canastas.',
  },
  {
    name: 'Whole table',
    hint: 'Everything, including every other player’s moves. Best when you play from home.',
  },
]

export const DEFAULT_SOUND_LEVEL: SoundLevel = 2

export type Sound =
  'turn' | 'roundOver' | 'gameOver' | 'draw' | 'discard' | 'meld' | 'pickup' | 'canasta' | 'chat'

/** A sound to play for something that just happened. */
export interface Cue {
  sound: Sound
  /** Your own move, or a moment that is yours (your turn, the end of a round). */
  mine: boolean
  /** For a meld, how many cards went down: one tap each. */
  cards?: number
}

/** What the table looked like when the sounds last ran. */
export interface SoundSnapshot {
  /** The deal: a new game, round or redeal starts a new feed. */
  deal: string
  feedLength: number
  status: GameStatus
  currentId: string | null
}

export function snapshotOf(view: PlayerView): SoundSnapshot {
  const round = view.round
  return {
    deal: round ? `${view.gameNumber}.${round.number}.${round.redeals}` : '',
    feedLength: round?.feed.length ?? 0,
    status: view.status,
    currentId: round ? (view.players[round.current]?.id ?? null) : null,
  }
}

/**
 * The cues for what changed since `previous`, in the order they happened. With no previous
 * snapshot (the first view, or the first after a reconnect) nothing plays, so a catch-up stays
 * quiet. Too many new events at once is a catch-up too, as it is for the table's animations.
 */
export function cuesFor(previous: SoundSnapshot | null, view: PlayerView): Cue[] {
  if (!previous) return []
  const now = snapshotOf(view)
  const youId = view.you?.id ?? null
  const cues: Cue[] = []

  const feed = view.round?.feed ?? []
  if (now.deal === previous.deal && feed.length > previous.feedLength) {
    const events = feed.slice(previous.feedLength)
    if (events.length <= MAX_ANIMATED_EVENTS) {
      for (const event of events) cues.push(...eventCues(event, youId))
    }
  }

  if (now.status !== previous.status) {
    // Game over replaces the round's end: the last round is scored on the way.
    if (now.status === 'gameOver') cues.push({ sound: 'gameOver', mine: true })
    else if (now.status === 'roundOver') cues.push({ sound: 'roundOver', mine: true })
  }

  const yourTurn = now.status === 'playing' && youId !== null && now.currentId === youId
  const turnStarted =
    previous.status !== 'playing' ||
    previous.currentId !== now.currentId ||
    previous.deal !== now.deal
  if (yourTurn && turnStarted) cues.push({ sound: 'turn', mine: true })
  return cues
}

function eventCues(event: FeedEvent, youId: string | null): Cue[] {
  switch (event.type) {
    case 'drewStock':
      return [{ sound: 'draw', mine: event.playerId === youId }]
    case 'discarded':
      return [{ sound: 'discard', mine: event.playerId === youId }]
    case 'melded': {
      const mine = event.playerId === youId
      const cards =
        event.played.newMelds.reduce((n, meld) => n + meld.length, 0) +
        event.played.additions.reduce((n, addition) => n + addition.cards.length, 0)
      const cues: Cue[] = [{ sound: 'meld', mine, cards }]
      if (event.canastas.length > 0) cues.push({ sound: 'canasta', mine })
      return cues
    }
    case 'pickedUpPile': {
      const mine = event.playerId === youId
      const cues: Cue[] = [{ sound: 'pickup', mine }]
      if (event.canastas?.length) cues.push({ sound: 'canasta', mine })
      return cues
    }
    default:
      return []
  }
}

/** The lowest step that plays a cue. */
export function stepFor(cue: Pick<Cue, 'sound' | 'mine'>): SoundLevel {
  if (cue.sound === 'turn' || cue.sound === 'roundOver' || cue.sound === 'gameOver') return 1
  // A chat line has its own switch, so it plays at every step but Off.
  if (cue.sound === 'chat') return 1
  return cue.mine ? 2 : 3
}

export const audible = (cue: Cue, level: SoundLevel) => level >= stepFor(cue)

/** The shortest gap between two chat clinks, in milliseconds, so a burst of lines clinks once. */
export const CHAT_CLINK_GAP = 4000

/** Whether a chat line heard at `now` clinks, given when the last clink played. */
export const clinkDue = (lastAt: number | null, now: number) =>
  lastAt === null || now - lastAt >= CHAT_CLINK_GAP

/** The rows of the "What each step plays" chart. */
export const SOUND_CHART: readonly {
  group: string
  rows: readonly { label: string; step: SoundLevel }[]
}[] = [
  {
    group: 'For you',
    rows: [
      { label: 'Your turn starts', step: 1 },
      { label: 'Round over', step: 1 },
      { label: 'Game over', step: 1 },
      { label: 'You draw', step: 2 },
      { label: 'You meld', step: 2 },
      { label: 'You discard', step: 2 },
      { label: 'You take the pile', step: 2 },
      { label: 'You make a canasta', step: 2 },
    ],
  },
  {
    group: 'Other players',
    rows: [
      { label: 'Someone draws, melds or discards', step: 3 },
      { label: 'Someone takes the pile', step: 3 },
      { label: 'Someone makes a canasta', step: 3 },
    ],
  },
]
