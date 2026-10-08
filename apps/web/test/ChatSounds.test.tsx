import type { ChatLine } from '@canasta/server/protocol'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatSounds } from '../src/components/ChatSounds'
import { CHAT_CLINK_GAP } from '../src/sounds'

const { playCues } = vi.hoisted(() => ({ playCues: vi.fn() }))
vi.mock('../src/soundPlayer', () => ({ playCues, listenForUnlock: () => {} }))

const line = (id: number, playerId = 'bob'): ChatLine => ({
  id,
  playerId,
  name: playerId,
  text: 'hi',
  at: id,
  anchor: { game: 1, round: 1, redeals: 0, after: 0 },
})

describe('ChatSounds', () => {
  let now = 10_000
  beforeEach(() => {
    now = 10_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    playCues.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('clinks for someone else’s line, not your own or the one heard before it mounted', () => {
    const { rerender } = render(<ChatSounds heard={line(1)} playerId="you" />)
    expect(playCues).not.toHaveBeenCalled()
    rerender(<ChatSounds heard={line(2, 'you')} playerId="you" />)
    expect(playCues).not.toHaveBeenCalled()
    rerender(<ChatSounds heard={line(3)} playerId="you" />)
    expect(playCues).toHaveBeenCalledWith([{ sound: 'chat', mine: true }])
  })

  it('clinks once for a burst of lines', () => {
    const { rerender } = render(<ChatSounds heard={null} playerId="you" />)
    rerender(<ChatSounds heard={line(1)} playerId="you" />)
    now += 1000
    rerender(<ChatSounds heard={line(2)} playerId="you" />)
    expect(playCues).toHaveBeenCalledTimes(1)
    now += CHAT_CLINK_GAP
    rerender(<ChatSounds heard={line(3)} playerId="you" />)
    expect(playCues).toHaveBeenCalledTimes(2)
  })
})
