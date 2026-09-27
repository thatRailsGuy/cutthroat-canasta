import { z } from 'zod'
import type { Action, PlayerView, RuleErrorCode } from '@canasta/engine'

export const MAX_MESSAGE_LENGTH = 16_384
export const MAX_NAME_LENGTH = 20

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

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    token: z.string().min(1).max(64).optional(),
  }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('nextRound') }),
  z.object({ type: z.literal('action'), action: actionSchema }),
])

export type ClientMessage = z.infer<typeof clientMessageSchema>

/** Fails to compile if the schema and the engine's Action type drift apart in either direction. */
type Assert<T extends true> = T
type SameType<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
export type ActionSchemaMatchesEngine = Assert<SameType<z.infer<typeof actionSchema>, Action>>

export type ProtocolErrorCode = 'BAD_MESSAGE' | 'NOT_JOINED' | 'NOT_HOST' | 'ALREADY_JOINED'
export type ServerErrorCode = RuleErrorCode | ProtocolErrorCode

export type ServerMessage =
  | { type: 'joined'; code: string; playerId: string; token: string }
  | { type: 'state'; view: PlayerView; hostId: string | null }
  | { type: 'error'; code: ServerErrorCode; message: string }

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
