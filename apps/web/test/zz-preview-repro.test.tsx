import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import PreviewPage from '../src/dev/PreviewPage'

it('repro', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><PreviewPage /></MemoryRouter>)
  await user.click(screen.getByText('Preview controls'))
  await user.click(screen.getByRole('button', { name: 'Someone joins' }))
  await user.click(screen.getByRole('button', { name: 'Watch as the newcomer' }))
  expect(screen.getByRole('heading', { name: /Pull up a chair/ })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Your hand' })).toBeNull()
})
