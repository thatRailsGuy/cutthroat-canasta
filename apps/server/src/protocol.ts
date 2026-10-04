import { z } from 'zod'
import type { Action, PlayerView, RuleErrorCode } from '@canasta/engine'

export const MAX_MESSAGE_LENGTH = 16_384
export const MAX_NAME_LENGTH = 20

/**
 * Heartbeat. The Durable Object answers `HEARTBEAT_PING` with `HEARTBEAT_PONG` through a
 * WebSocket auto-response, so a ping never wakes it. The strings must match exactly.
 */
export const HEARTBEAT_PING = '{"type":"ping"}'
export const HEARTBEAT_PONG = '{"type":"pong"}'
/** How often the client pings. */
export const HEARTBEAT_INTERVAL_MS = 20_000
/**
 * A socket that has sent nothing for this long no longer counts as connected. It spans more
 * than three pings, because browsers may slow timers in background tabs to once a minute.
 */
export const STALE_AFTER_MS = 70_000
/** Close code for a socket the server dropped as stale. The client reconnects with its token. */
export const STALE_CLOSE_CODE = 4000

const cardId = z.number().int().nonnegative()
const cardIds = z.array(cardId).max(60)
const meldBatch = z.object({
  newMelds: z.array(cardIds).max(20),
  additions: z.array(z.object({ meldId: z.string().max(32), cardIds })).max(20),
})

export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('drawStock') }),
  z.object({ type: z.literal('pickUpPile'), play: meldBatch }),
  z.object({ type: z.literal('meld'), play: meldBatch }),
  z.object({ type: z.literal('discard'), cardId }),
])

const joinName = z
  .string()
  .transform((name) =>
    name
      .normalize('NFKC')
      .replace(/[\p{Cc}\p{Cf}]/gu, '')
      .trim(),
  )
  .pipe(z.string().min(1).max(MAX_NAME_LENGTH))

const playerId = z.string().min(1).max(64)

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    name: joinName,
    token: z.string().min(1).max(64).optional(),
  }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('nextRound') }),
  z.object({ type: z.literal('redeal') }),
  z.object({ type: z.literal('action'), action: actionSchema }),
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('kick'), playerId }),
  z.object({ type: z.literal('reissue'), playerId }),
])

export type ClientMessage = z.infer<typeof clientMessageSchema>

/** Fails to compile if the schema and the engine's Action type drift apart in either direction. */
type Assert<T extends true> = T
type SameType<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
export type ActionSchemaMatchesEngine = Assert<SameType<z.infer<typeof actionSchema>, Action>>

export type ProtocolErrorCode =
  | 'BAD_MESSAGE'
  | 'NOT_JOINED'
  | 'NOT_HOST'
  | 'ALREADY_JOINED'
  | 'NO_SUCH_PLAYER'
  | 'PLAYER_CONNECTED'
  | 'UNKNOWN_TOKEN'
export type ServerErrorCode = RuleErrorCode | ProtocolErrorCode

export type ServerMessage =
  | { type: 'joined'; code: string; playerId: string; token: string }
  | { type: 'state'; view: PlayerView; hostId: string | null; connected: string[] }
  | { type: 'error'; code: ServerErrorCode; message: string }
  | { type: 'removed'; reason: RemovedReason }
  | { type: 'reissued'; playerId: string; token: string }
  | { type: 'seatReissued'; playerId: string }
  /** A player quit a started game. The name is sent too, since they are no longer seated. */
  | { type: 'playerQuit'; playerId: string; name: string }
  /** The heartbeat reply. The runtime's auto-response sends it, never the room handler. */
  | { type: 'pong' }

/** Why a socket's seat went away: it left the lobby, quit a started game, or was kicked. */
export type RemovedReason = 'left' | 'quit' | 'kicked'

export type ParseResult = { ok: true; message: ClientMessage } | { ok: false; error: ServerMessage }

export function parseClientMessage(raw: string | ArrayBuffer): ParseResult {
  if (typeof raw !== 'string') return badMessage('Messages must be JSON text.')
  if (raw.length > MAX_MESSAGE_LENGTH) return badMessage('Message is too large.')
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return badMessage('Message is not valid JSON.')
  }
  const result = clientMessageSchema.safeParse(data)
  if (!result.success) return badMessage('Message has an invalid shape.')
  return { ok: true, message: result.data }
}

function badMessage(message: string): ParseResult {
  return { ok: false, error: { type: 'error', code: 'BAD_MESSAGE', message } }
}
