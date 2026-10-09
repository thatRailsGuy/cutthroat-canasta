import type { FeedEvent, PublicPlayer } from '@canasta/engine'
import type { ChatLine } from '@canasta/server/protocol'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TableTalk } from '../src/components/TableTalk'
import { useSoundLevel } from '../src/soundLevel'

const player = (id: string, name: string): PublicPlayer => ({
  id,
  name,
  score: 0,
  handCount: 11,
  melds: [],
  red3s: [],
  turnsThisRound: 1,
  hasPickedUpPile: false,
})
const players = [player('you', 'Ann'), player('bob', 'Bob')]
const events: FeedEvent[] = [
  { type: 'drewStock', playerId: 'bob', red3s: [] },
  { type: 'wentOut', playerId: 'bob' },
]
const chat: ChatLine[] = [
  {
    id: 1,
    playerId: 'bob',
    name: 'Bob',
    text: 'my turn',
    at: 1,
    anchor: { game: 1, round: 1, redeals: 0, after: 1 },
  },
  {
    id: 2,
    playerId: 'you',
    name: 'Ann',
    text: 'nice one',
    at: 2,
    anchor: { game: 1, round: 1, redeals: 0, after: 2 },
  },
]

function Talk({
  onSend = vi.fn(() => true),
  offline = false,
}: {
  onSend?: (text: string) => boolean
  offline?: boolean
}) {
  const [text, setText] = useState('')
  return (
    <TableTalk
      events={events}
      deal={{ game: 1, round: 1, redeals: 0 }}
      chat={chat}
      notices={[]}
      players={players}
      playerId="you"
      offline={offline}
      talk={{
        text,
        onType: setText,
        onSend: (t) => {
          const sent = onSend(t)
          if (sent) setText('')
          return sent
        },
        onRead: () => {},
      }}
    />
  )
}

describe('TableTalk', () => {
  it('lists events and chat oldest first, with your own lines as You', () => {
    render(<Talk />)
    const items = within(screen.getByRole('list', { name: 'Table events and chat' })).getAllByRole(
      'listitem',
    )
    expect(items.map((li) => li.textContent)).toEqual([
      'Bob drew a card',
      'Bob: my turn',
      'Bob went out',
      'You: nice one',
    ])
  })

  it('sends cleaned text and clears the input', async () => {
    const onSend = vi.fn(() => true)
    render(<Talk onSend={onSend} />)
    const input = screen.getByRole('textbox', { name: 'Message to the table' })
    await userEvent.type(input, '  gg   wp {Enter}')
    expect(onSend).toHaveBeenCalledWith('gg wp')
    expect(input).toHaveValue('')
  })

  it('blocks empty and over-long lines, and counts characters near the limit', async () => {
    render(<Talk />)
    const send = screen.getByRole('button', { name: 'Send' })
    expect(send).toBeDisabled()
    const input = screen.getByRole('textbox', { name: 'Message to the table' })
    await userEvent.click(input)
    await userEvent.paste('x'.repeat(160))
    expect(screen.getByText('160 / 200')).toBeInTheDocument()
    expect(send).toBeEnabled()
    await userEvent.paste('x'.repeat(41))
    expect(screen.getByText('201 / 200')).toBeInTheDocument()
    expect(send).toBeDisabled()
  })

  it('can’t send while offline', async () => {
    render(<Talk offline />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Message to the table' }), 'hi')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('turns the chat clink off and on with the bell, unless all sound is off', async () => {
    function Speaker() {
      const [, setLevel] = useSoundLevel()
      return (
        <>
          <button type="button" onClick={() => setLevel(0)}>
            Sound off
          </button>
          <button type="button" onClick={() => setLevel(2)}>
            Sound on
          </button>
        </>
      )
    }
    render(
      <>
        <Talk />
        <Speaker />
      </>,
    )
    const bell = screen.getByRole('button', { name: 'Chat sound' })
    expect(bell).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(bell)
    expect(bell).toHaveAttribute('aria-pressed', 'false')
    expect(localStorage.getItem('canasta:chatSound')).toBe('off')

    await userEvent.click(screen.getByRole('button', { name: 'Sound off' }))
    const muted = screen.getByRole('button', { name: /off because all sound is off/ })
    expect(muted).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(muted)
    await userEvent.click(screen.getByRole('button', { name: 'Sound on' }))
    // The choice made before the sound went off comes back.
    await userEvent.click(screen.getByRole('button', { name: 'Chat sound' }))
    expect(screen.getByRole('button', { name: 'Chat sound' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    localStorage.clear()
  })
})
