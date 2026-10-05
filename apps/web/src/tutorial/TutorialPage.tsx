import { applyAction, viewFor, type Game } from '@canasta/engine'
import type { ClientMessage } from '@canasta/server/protocol'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { describeEvent } from '../feed'
import { TableSounds } from '../components/TableSounds'
import { initialGameState, type GameState } from '../gameState'
import { Table } from '../pages/Table'
import { Coach } from './Coach'
import { advance, DOT, focusFor, isTurnOf, lessonGame, playDot, STEPS, YOU } from './lesson'

/** How long Dot takes over each move, so you can follow it on the table. */
const DOT_PAUSE_MS = 1100

const lessonState: GameState = {
  ...initialGameState,
  connection: 'open',
  playerId: YOU,
  // No host: the host's tools (rejoin links) mean nothing in a practice hand.
  hostId: null,
  connected: [YOU, DOT],
}

interface Lesson {
  game: Game
  step: number
  /** Why your last move was refused. */
  hint: string | null
  /** How many moves have been refused, so each refusal shakes the card. */
  refusals: number
}

const start = (): Lesson => ({ game: lessonGame(), step: 0, hint: null, refusals: 0 })

/** `/learn`: a practice hand on the real table, with a lesson card that walks you through it. */
export function TutorialPage() {
  const navigate = useNavigate()
  const [lesson, setLesson] = useState(start)
  const { game, step, hint, refusals } = lesson
  const view = useMemo(() => viewFor(game, YOU), [game])
  const focus = useMemo(() => focusFor(step, game), [step, game])
  // Dot's moves since your last one, while she plays.
  const feed = game.round?.feed ?? []
  const yourLast = feed.map((e) => 'playerId' in e && e.playerId === YOU).lastIndexOf(true)
  const moves = STEPS[step].waiting
    ? feed.slice(yourLast + 1).map((e) => describeEvent(e, view.players))
    : []

  useEffect(() => {
    if (!isTurnOf(game, DOT)) return
    const timer = setTimeout(() => {
      setLesson((l) => {
        const next = playDot(l.game)
        return { ...l, game: next, step: advance(l.step, next), hint: null }
      })
    }, DOT_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [game])

  const send = (message: ClientMessage) => {
    if (message.type === 'leave') {
      void navigate('/')
      return true
    }
    if (message.type === 'nextRound') {
      void navigate('/', { state: { notice: 'Nice hand! Create a game to play for real.' } })
      return true
    }
    if (message.type !== 'action') return true

    const current = STEPS[step]
    const refused = current.allow
      ? current.allow(message.action, game)
      : current.waiting
        ? 'Wait for Dot to finish her turn.'
        : 'Read this step, then click Next.'
    if (refused) {
      setLesson({ ...lesson, hint: refused, refusals: refusals + 1 })
      return false
    }
    const result = applyAction(game, YOU, message.action)
    if (!result.ok) {
      setLesson({ ...lesson, hint: result.error.message, refusals: refusals + 1 })
      return false
    }
    setLesson({ ...lesson, game: result.game, step: advance(step, result.game), hint: null })
    return true
  }

  return (
    <>
      <Table
        code="LESSON"
        view={view}
        state={lessonState}
        send={send}
        lit={focus.cards}
        coach={
          <Coach
            step={step}
            hint={hint}
            refusals={refusals}
            focus={focus}
            moves={moves}
            onNext={() => setLesson({ ...lesson, step: advance(step + 1, game), hint: null })}
            onRestart={() => setLesson(start())}
          />
        }
      />
      <TableSounds view={view} live />
    </>
  )
}
