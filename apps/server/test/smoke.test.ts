import { SELF } from 'cloudflare:test'
import { expect, it } from 'vitest'

it('responds 404 to unknown routes', async () => {
  const response = await SELF.fetch('http://example.com/nope')
  expect(response.status).toBe(404)
})
