import { describe, expect, it } from 'vitest'
import { MAX_MESSAGE_LENGTH, parseClientMessage, type ParseResult } from '../src/protocol'

const parse = (value: unknown) => parseClientMessage(JSON.stringify(value))
const errorCode = (result: ParseResult) => (result.ok ? null : result.error)

describe('parseClientMessage accepts', () => {
  it.each([
    { type: 'join', name: 'Ann' },
    { type: 'join', name: 'Ann', token: 'abc' },
    { type: 'start' },
    { type: 'nextRound' },
    { type: 'action', action: { type: 'drawStock' } },
    { type: 'action', action: { type: 'discard', cardId: 12 } },
    {
      type: 'action',
      action: { type: 'meld', play: { newMelds: [[1, 2, 3]], additions: [] } },
    },
    {
      type: 'action',
      action: {
        type: 'pickUpPile',
        play: { newMelds: [], additions: [{ meldId: 'm0', cardIds: [7] }] },
      },
    },
  ])('%j', (message) => {
    expect(parse(message)).toEqual({ ok: true, message })
  })

  it('trims join names', () => {
    expect(parse({ type: 'join', name: '  Ann  ' })).toEqual({
      ok: true,
      message: { type: 'join', name: 'Ann' },
    })
  })

  it('drops unknown fields', () => {
    expect(parse({ type: 'start', extra: true })).toEqual({ ok: true, message: { type: 'start' } })
  })
})

describe('parseClientMessage rejects', () => {
  it.each([
    ['an unknown message type', { type: 'dance' }],
    ['a blank name', { type: 'join', name: '   ' }],
    ['a name over 20 characters', { type: 'join', name: 'x'.repeat(21) }],
    ['an unknown action type', { type: 'action', action: { type: 'bogus' } }],
    ['a negative card id', { type: 'action', action: { type: 'discard', cardId: -1 } }],
    ['a fractional card id', { type: 'action', action: { type: 'discard', cardId: 1.5 } }],
    ['a string card id', { type: 'action', action: { type: 'discard', cardId: '3' } }],
    ['a meld without a play', { type: 'action', action: { type: 'meld' } }],
  ])('%s', (_, message) => {
    expect(errorCode(parse(message))).toMatchObject({ type: 'error', code: 'BAD_MESSAGE' })
  })

  it('binary frames', () => {
    expect(errorCode(parseClientMessage(new ArrayBuffer(4)))).toMatchObject({
      code: 'BAD_MESSAGE',
      message: 'Messages must be JSON text.',
    })
  })

  it('invalid JSON', () => {
    expect(errorCode(parseClientMessage('{nope'))).toMatchObject({
      code: 'BAD_MESSAGE',
      message: 'Message is not valid JSON.',
    })
  })

  it('oversized messages before parsing them', () => {
    expect(errorCode(parseClientMessage('x'.repeat(MAX_MESSAGE_LENGTH + 1)))).toMatchObject({
      code: 'BAD_MESSAGE',
      message: 'Message is too large.',
    })
  })
})
