import { applyAction, viewFor, type Game } from '@canasta/engine'
import type { ClientMessage } from '@canasta/server/protocol'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { initialGameState, type GameState } from '../gameState'
import { Table } from '../pages/Table'
import { Coach } from './Coach'
import { advance, DOT, isTurnOf, lessonGame, playDot, STEPS, YOU } from './lesson'

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
}

const start = (): Lesson => ({ game: lessonGame(), step: 0, hint: null })

/** `/learn`: a practice hand on the real table, with a lesson card that walks you through it. */
export function TutorialPage() {
  const navigate = useNavigate()
  const [lesson, setLesson] = useState(start)
  const { game, step, hint } = lesson
  const view = useMemo(() => viewFor(game, YOU), [game])

  useEffect(() => {
    if (!isTurnOf(game, DOT)) return
    const timer = setTimeout(() => {
      setLesson((l) => {
        const next = playDot(l.game)
        return { game: next, step: advance(l.step, next), hint: null }
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
      setLesson({ ...lesson, hint: refused })
      return false
    }
    const result = applyAction(game, YOU, message.action)
    if (!result.ok) {
      setLesson({ ...lesson, hint: result.error.message })
      return false
    }
    setLesson({ game: result.game, step: advance(step, result.game), hint: null })
    return true
  }

  return (
    <Table
      code="LESSON"
      view={view}
      state={lessonState}
      send={send}
      coach={
        <Coach
          step={step}
          hint={hint}
          onNext={() => setLesson({ ...lesson, step: advance(step + 1, game), hint: null })}
          onRestart={() => setLesson(start())}
        />
      }
    />
  )
}
