import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QrCode } from '../src/components/QrCode'

describe('QrCode', () => {
  it('draws the text as a labeled QR code with a quiet zone', () => {
    render(<QrCode text="http://localhost:5173/g/ABC123" label="Join link" />)
    const svg = screen.getByRole('img', { name: 'Join link' })
    const d = svg.querySelector('path')!.getAttribute('d')!
    // The first dark module is the top-left corner of the finder pattern, inside a 4-module quiet zone.
    expect(d).toMatch(/^M4 4h1v1h-1z/)
  })
})
