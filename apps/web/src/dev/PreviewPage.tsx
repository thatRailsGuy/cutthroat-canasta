import type { Card, FeedEvent, Meld, PlayerView, Rank, Suit } from '@canasta/engine'
import type { ClientMessage } from '@canasta/server/protocol'
import { useState } from 'react'
import { initialGameState, type GameState } from '../gameState'
import { Table } from '../pages/Table'
import styles from './PreviewPage.module.css'

/**
 * Dev only (`/dev/table`): the table with a made-up three-player game, and buttons that act
 * out moments on it, for working on the look and the animations without playing a game.
 */
export default function PreviewPage() {
  const [view, setView] = useState(startingView)
  const change = (fn: (draft: PlayerView) => void) =>
    setView((v) => {
      const draft = structuredClone(v)
      fn(draft)
      return draft
    })
  const feed = (draft: PlayerView, event: FeedEvent) => draft.round!.feed.push(event)

  const send = (message: ClientMessage) => {
    if (message.type !== 'action') return true
    const action = message.action
    change((d) => {
      const you = d.you!
      const round = d.round!
      if (action.type === 'drawStock') {
        const c = nextCard()
        you.hand.push(c)
        you.drawnCard = c.id
        round.stockCount--
        round.phase = 'play'
        feed(d, { type: 'drewStock', playerId: you.id, red3s: [] })
      } else if (action.type === 'discard') {
        const c = you.hand.find((h) => h.id === action.cardId)!
        you.hand = you.hand.filter((h) => h.id !== action.cardId)
        you.drawnCard = null
        round.discardTop = c
        round.discardCount++
        round.phase = 'draw'
        feed(d, { type: 'discarded', playerId: you.id, card: c })
      }
      syncYou(d)
    })
    return true
  }

  const acts: [string, () => void][] = [
    [
      'Ben draws',
      () =>
        change((d) => {
          d.players[1].handCount++
          d.round!.stockCount--
          feed(d, { type: 'drewStock', playerId: 'ben', red3s: [] })
        }),
    ],
    [
      'Ben discards',
      () =>
        change((d) => {
          d.players[1].handCount--
          const c = nextCard()
          d.round!.discardTop = c
          d.round!.discardCount++
          feed(d, { type: 'discarded', playerId: 'ben', card: c })
        }),
    ],
    [
      'Ben discards a wild',
      () =>
        change((d) => {
          d.players[1].handCount--
          const c = card('2s')
          d.round!.discardTop = c
          d.round!.discardCount++
          d.round!.pileFrozenForAll = true
          d.round!.frozenBy = c
          feed(d, { type: 'discarded', playerId: 'ben', card: c })
        }),
    ],
    [
      'Cara picks up the pile',
      () =>
        change((d) => {
          const count = d.round!.discardCount
          d.players[2].handCount += count - 2
          d.players[2].melds.push(meld(['Kh', 'Kc', 'Ks']))
          d.round!.discardTop = null
          d.round!.discardCount = 0
          d.round!.pileFrozenForAll = false
          d.round!.frozenBy = null
          feed(d, {
            type: 'pickedUpPile',
            playerId: 'cara',
            count,
            played: { newMelds: [], additions: [] },
            canastas: [],
            red3s: [],
          })
        }),
    ],
    [
      'You pick up the pile',
      () =>
        change((d) => {
          const you = d.you!
          const count = Math.max(d.round!.discardCount, 1)
          for (let i = 0; i < count; i++) you.hand.push(nextCard())
          you.hasPickedUpPile = true
          d.round!.discardTop = null
          d.round!.discardCount = 0
          d.round!.phase = 'play'
          feed(d, {
            type: 'pickedUpPile',
            playerId: you.id,
            count,
            played: { newMelds: [], additions: [] },
            canastas: [],
            red3s: [],
          })
          syncYou(d)
        }),
    ],
    [
      'Ben finishes a canasta',
      () =>
        change((d) => {
          const meld = d.players[1].melds.find((m) => m.cards.length < 7)
          if (!meld) return
          while (meld.cards.length < 7) meld.cards.push(card(`${meld.rank}d`))
          feed(d, {
            type: 'melded',
            playerId: 'ben',
            played: { newMelds: [], additions: [] },
            canastas: [{ rank: meld.rank, natural: true }],
          })
        }),
    ],
    [
      'You finish a canasta',
      () =>
        change((d) => {
          const meld = d.you!.melds.find((m) => m.cards.length < 7)
          if (!meld) return
          meld.cards.push(card('2c'))
          while (meld.cards.length < 7) meld.cards.push(card(`${meld.rank}h`))
          feed(d, {
            type: 'melded',
            playerId: d.you!.id,
            played: { newMelds: [], additions: [] },
            canastas: [{ rank: meld.rank, natural: false }],
          })
          syncYou(d)
        }),
    ],
    [
      'Cara draws a red 3',
      () =>
        change((d) => {
          const red3 = card('3h')
          d.players[2].red3s.push(red3)
          d.players[2].handCount++
          d.round!.stockCount -= 2
          feed(d, { type: 'drewStock', playerId: 'cara', red3s: [red3] })
        }),
    ],
    [
      'Black 3 on top',
      () =>
        change((d) => {
          d.round!.discardTop = card('3s')
          d.round!.discardCount++
        }),
    ],
    [
      'Toggle frozen for you',
      () =>
        change((d) => {
          d.you!.hasPickedUpPile = !d.you!.hasPickedUpPile
        }),
    ],
    [
      'Your turn',
      () =>
        change((d) => {
          d.round!.current = 0
          d.round!.phase = 'draw'
          d.you!.drawnCard = null
          if (!d.round!.discardTop) {
            d.round!.discardTop = card('Qh')
            d.round!.discardCount = 1
          }
        }),
    ],
    [
      "Ben's turn",
      () =>
        change((d) => {
          d.round!.current = 1
        }),
    ],
    [
      'End the round',
      () =>
        change((d) => {
          const total = { ann: 865, ben: 1210, cara: -35 } as Record<string, number>
          d.history.push({
            round: d.history.length + 1,
            endedBy: 'goingOut',
            wentOut: 'ben',
            breakdown: Object.fromEntries(
              d.players.map((p) => [
                p.id,
                {
                  meldPoints: total[p.id] - 300,
                  canastaBonus: p.id === 'cara' ? 0 : 300,
                  red3Points: 0,
                  goingOutBonus: p.id === 'ben' ? 100 : 0,
                  concealedBonus: 0,
                  handPenalty: p.id === 'ben' ? 100 : 0,
                  total: total[p.id],
                },
              ]),
            ),
            hands: { ann: d.you!.hand.slice(0, 4), ben: [], cara: [card('7c'), card('9d')] },
          })
          for (const p of d.players) p.score += total[p.id]
          d.status = 'roundOver'
          syncYou(d)
        }),
    ],
  ]

  return (
    <>
      <Table code="PREVIEW" view={view} state={previewState} send={send} />
      <details className={styles.controls}>
        <summary>Preview controls</summary>
        {acts.map(([label, run]) => (
          <button key={label} type="button" onClick={run}>
            {label}
          </button>
        ))}
        <button type="button" onClick={() => setView(startingView())}>
          Reset
        </button>
      </details>
    </>
  )
}

let id = 1000
const nextId = () => id++
const SUITS: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' }

/** 'Kh' → king of hearts, 'JK' → joker. */
function card(code: string): Card {
  if (code === 'JK') return { id: nextId(), rank: 'JOKER', suit: null }
  return { id: nextId(), rank: code.slice(0, -1) as Rank, suit: SUITS[code.slice(-1)] }
}

const DECK = ['9h', '5s', 'Kd', '6c', 'Ah', '10d', '4s', 'Jh', '8c', 'Qs', '7d', '2h']
function nextCard(): Card {
  return card(DECK[id % DECK.length])
}

function meld(codes: string[]): Meld {
  const cards = codes.map(card)
  const natural = cards.find((c) => c.rank !== 'JOKER' && c.rank !== '2')!
  return { id: `m${nextId()}`, rank: natural.rank as Meld['rank'], cards }
}

/** Keeps your public seat in step with your private one. */
function syncYou(view: PlayerView) {
  const you = view.you!
  const seat = view.players.find((p) => p.id === you.id)!
  seat.handCount = you.hand.length
  seat.melds = you.melds
  seat.red3s = you.red3s
  you.score = seat.score
}

function startingView(): PlayerView {
  const hand = ['4c', '4h', '6s', '8d', '8c', '8h', '10s', 'Jc', 'Qd', 'As', '2h'].map(card)
  const yourMelds = [
    meld(['Ah', 'Ac', 'Ad', 'As', 'Ah', '2c', 'JK']),
    meld(['Qc', 'Qs', 'Qh']),
    meld(['7h', '7s', '7c', 'JK']),
  ]
  const you = {
    id: 'ann',
    name: 'Ann',
    score: 1240,
    hand,
    melds: yourMelds,
    red3s: [card('3d')],
    hasPickedUpPile: false,
    turnsThisRound: 3,
    meldedBeforeThisTurn: true,
    drawnCard: null,
  }
  const view: PlayerView = {
    you,
    players: [
      {
        id: 'ann',
        name: 'Ann',
        score: 1240,
        handCount: hand.length,
        melds: yourMelds,
        red3s: you.red3s,
        turnsThisRound: 3,
      },
      {
        id: 'ben',
        name: 'Ben',
        score: 2015,
        handCount: 9,
        melds: [meld(['Ks', 'Kh', 'Kd', 'Kc', 'Ks', 'Kh', 'Kd']), meld(['9c', '9d', '9s', '2s'])],
        red3s: [],
        turnsThisRound: 3,
      },
      {
        id: 'cara',
        name: 'Cara',
        score: 860,
        handCount: 4,
        melds: [meld(['Js', 'Jh', 'Jc'])],
        red3s: [],
        turnsThisRound: 3,
      },
    ],
    round: {
      number: 4,
      dealer: 2,
      current: 0,
      phase: 'draw',
      stockCount: 64,
      discardTop: card('Qh'),
      discardCount: 9,
      pileFrozenForAll: false,
      frozenBy: null,
      feed: [
        { type: 'melded', playerId: 'ben', played: { newMelds: [], additions: [] }, canastas: [] },
        { type: 'discarded', playerId: 'ben', card: card('5c') },
        { type: 'drewStock', playerId: 'cara', red3s: [] },
        { type: 'discarded', playerId: 'cara', card: card('Qh') },
      ],
    },
    history: [
      scored(1, { ann: 355, ben: 910, cara: -45 }),
      scored(2, { ann: 520, ben: 385, cara: 615 }),
      scored(3, { ann: 365, ben: 720, cara: 290 }),
    ],
    status: 'playing',
    winners: [],
    quit: [],
  }
  return view
}

function scored(round: number, totals: Record<string, number>) {
  return {
    round,
    endedBy: 'goingOut' as const,
    wentOut: 'ben',
    breakdown: Object.fromEntries(
      Object.entries(totals).map(([p, total]) => [
        p,
        {
          meldPoints: total,
          canastaBonus: 0,
          red3Points: 0,
          goingOutBonus: 0,
          concealedBonus: 0,
          handPenalty: 0,
          total,
        },
      ]),
    ),
    hands: {},
  }
}

const previewState: GameState = {
  ...initialGameState,
  connection: 'open',
  playerId: 'ann',
  hostId: 'ann',
  connected: ['ann', 'ben', 'cara'],
}
