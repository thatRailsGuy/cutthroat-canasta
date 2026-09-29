import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { App } from '../src/App'

it('renders in jsdom with jest-dom matchers', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Cutthroat Canasta' })).toBeInTheDocument()
})
