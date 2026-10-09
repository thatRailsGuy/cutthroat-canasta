import { render } from '@testing-library/react'
import axe from 'axe-core'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { DisplaySwitches } from '../src/components/DisplayOptions'
import { initialGameState } from '../src/gameState'
import { HomePage } from '../src/pages/HomePage'
import { Lobby } from '../src/pages/Lobby'
import { RulesPage } from '../src/pages/RulesPage'
import { Table } from '../src/pages/Table'
import { card, makeView } from './fixtures'

/**
 * axe-core over each page, so accessibility regressions fail the tests. jsdom has no layout,
 * so the checks that need one (contrast, target size) can only run in a browser.
 */
const OPTIONS: axe.RunOptions = {
  runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
  rules: {
    'color-contrast': { enabled: false },
    'target-size': { enabled: false },
    // A card button shows "K♥" and is named "King of hearts". The face is a symbol, not a
    // text label, and the name is what a speech-input user would say.
    'label-content-name-mismatch': { enabled: false },
    // A part of a page is rendered on its own here, without the app's landmarks around it.
    region: { enabled: false },
  },
}

async function violations(ui: ReactNode) {
  const { container } = render(<MemoryRouter>{ui}</MemoryRouter>)
  const results = await axe.run(container, OPTIONS)
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)
}

describe('accessibility', () => {
  it('home page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ tables: [] })),
    )
    expect(await violations(<HomePage />)).toEqual([])
    vi.unstubAllGlobals()
  })

  it('lobby, as the host', async () => {
    const view = { ...makeView({ hand: [], phase: 'draw' }), status: 'lobby' as const }
    expect(
      await violations(
        <Lobby
          code="HT7KM4"
          view={view}
          playerId="you"
          hostId="you"
          connected={['you']}
          isPublic
          kicked={[{ playerId: 'dave', name: 'Dave' }]}
          chat={[]}
          offline={false}
          send={() => true}
          talk={{ text: '', onType: () => {}, onSend: () => true, onRead: () => {} }}
        />,
      ),
    ).toEqual([])
  })

  it('table, on your turn', async () => {
    const view = makeView({
      hand: [card('Kh', 1), card('Ks', 2), card('2c', 3), card('3h', 4), card('7d', 5)],
      phase: 'play',
    })
    const state = { ...initialGameState, playerId: 'you', view, connection: 'open' as const }
    expect(
      await violations(<Table code="HT7KM4" view={view} state={state} send={() => true} />),
    ).toEqual([])
  })

  it('display options', async () => {
    expect(await violations(<DisplaySwitches />)).toEqual([])
  })

  it('rules page', async () => {
    expect(await violations(<RulesPage />)).toEqual([])
  })
})
