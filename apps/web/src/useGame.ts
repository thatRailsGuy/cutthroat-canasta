import type { ClientMessage } from '@canasta/server/protocol'
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { socketUrl } from './api'
import { GameConnection } from './connection'
import { gameReducer, initialGameState, type GameState } from './gameState'
import { clearToken, loadName, loadToken, saveName, saveToken } from './storage'

export interface GameOptions {
  /** A token from a rejoin link. It is saved before the first connect. */
  linkToken: string | null
  /** Join with this name as soon as the socket opens (set by the home page). */
  autoJoinName: string | null
}

export interface GameControls {
  state: GameState
  join(name: string): void
  /** Returns false, and shows a toast, if the socket isn't open, so the message was not sent. */
  send(message: ClientMessage): boolean
  dismissToast(id: number): void
}

/**
 * Connects to one game. On every open it joins with the saved token, or with a name the player
 * gave, so a reconnect gets the same seat back.
 */
export function useGame(code: string, { linkToken, autoJoinName }: GameOptions): GameControls {
  const [state, dispatch] = useReducer(gameReducer, initialGameState)
  const connectionRef = useRef<GameConnection | null>(null)
  const pendingNameRef = useRef<string | null>(null)
  /** Set while a join is in flight; `withToken` says whether it used a saved token. */
  const joiningRef = useRef<{ withToken: boolean } | null>(null)
  const sendJoinRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (linkToken) saveToken(code, linkToken)
    pendingNameRef.current = autoJoinName

    const sendJoin = () => {
      const token = loadToken(code)
      const name = pendingNameRef.current ?? (loadName() || 'Player')
      if (!token && pendingNameRef.current === null) return
      const message: ClientMessage = token ? { type: 'join', name, token } : { type: 'join', name }
      if (!connection.send(message)) return
      joiningRef.current = { withToken: token !== null }
      dispatch({ type: 'joining' })
    }

    const connection = new GameConnection({
      url: socketUrl(code),
      onOpen: sendJoin,
      onStatus: (status, failures) => dispatch({ type: 'status', status, failures }),
      onMessage: (message) => {
        const joining = joiningRef.current
        const joinFailed = message.type === 'error' && joining !== null
        if (message.type === 'joined' || joinFailed) {
          joiningRef.current = null
          pendingNameRef.current = null
        }
        if (message.type === 'joined') saveToken(code, message.token)
        // A saved token that no longer works (the seat was reissued) is useless: forget it.
        if (joinFailed && joining?.withToken) clearToken(code)
        if (message.type === 'removed') {
          clearToken(code)
          connection.stop()
        }
        dispatch({ type: 'message', message, joinFailed })
      },
    })
    connectionRef.current = connection
    sendJoinRef.current = sendJoin
    connection.start()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') connection.check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      connection.stop()
      connectionRef.current = null
    }
  }, [code, linkToken, autoJoinName])

  const join = useCallback((name: string) => {
    saveName(name)
    pendingNameRef.current = name
    sendJoinRef.current()
  }, [])

  const send = useCallback((message: ClientMessage) => {
    const sent = connectionRef.current?.send(message) ?? false
    if (!sent) dispatch({ type: 'notSent' })
    return sent
  }, [])

  const dismissToast = useCallback((id: number) => dispatch({ type: 'dismissToast', id }), [])

  return { state, join, send, dismissToast }
}
