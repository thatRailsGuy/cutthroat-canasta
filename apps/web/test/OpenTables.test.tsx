import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenTables } from '../src/components/OpenTables'

const tables = [
  { code: 'NEWONE', host: 'Rosalind', others: ['Pete', 'Dot'], seats: 3, maxSeats: 8 },
  { code: 'OLDONE', host: 'Jo', others: [], seats: 1, maxSeats: 8 },
]

function stubTables(list: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ tables: list })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OpenTables', () => {
  it('lists each table with its host, players and seats', async () => {
    stubTables(tables)
    render(<OpenTables canJoin onJoin={vi.fn()} />)
    expect(await screen.findByText("Rosalind's table")).toBeInTheDocument()
    expect(screen.getByText('with Pete, Dot')).toBeInTheDocument()
    expect(screen.getByText('3 of 8')).toBeInTheDocument()
    expect(screen.getByText('waiting for players')).toBeInTheDocument()
  })

  it('joins the table chosen', async () => {
    stubTables(tables)
    const onJoin = vi.fn()
    render(<OpenTables canJoin onJoin={onJoin} />)
    await userEvent.click(await screen.findByRole('button', { name: "Join Jo's table" }))
    expect(onJoin).toHaveBeenCalledWith('OLDONE')
  })

  it('asks for a name before anyone can join', async () => {
    stubTables(tables)
    render(<OpenTables canJoin={false} onJoin={vi.fn()} />)
    expect(await screen.findByRole('button', { name: "Join Jo's table" })).toBeDisabled()
    expect(screen.getByText('Type your name above to join a table.')).toBeInTheDocument()
  })

  it('says how to list a table when none are open', async () => {
    stubTables([])
    render(<OpenTables canJoin onJoin={vi.fn()} />)
    expect(await screen.findByText('No open tables right now')).toBeInTheDocument()
  })
})
