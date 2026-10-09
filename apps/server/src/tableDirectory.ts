import { DurableObject } from 'cloudflare:workers'
import { addressKey } from './address'
import type { OpenTable } from './protocol'
import { LISTING_TTL_MS, openTables, type DirectoryEntry, type Listing } from './tables'

/**
 * The one list of public lobbies, for the home page. Rooms put themselves on it and take
 * themselves off; a room that stops reporting drops off after LISTING_TTL_MS.
 */
export class TableDirectory extends DurableObject<Env> {
  private entries = new Map<string, DirectoryEntry>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.entries = await ctx.storage.list<DirectoryEntry>()
    })
  }

  async put(listing: Listing): Promise<void> {
    const now = Date.now()
    const listedAt = this.entries.get(listing.code)?.listedAt ?? now
    const entry: DirectoryEntry = { ...listing, listedAt, seenAt: now }
    this.entries.set(listing.code, entry)
    await this.ctx.storage.put(listing.code, entry)
  }

  async remove(code: string): Promise<void> {
    if (!this.entries.delete(code)) return
    await this.ctx.storage.delete(code)
  }

  /** `ip` is the caller's, to leave out tables that kicked them. */
  async list(ip: string | null): Promise<OpenTable[]> {
    const now = Date.now()
    const expired = [...this.entries.values()].filter((e) => now - e.seenAt > LISTING_TTL_MS)
    for (const e of expired) this.entries.delete(e.code)
    if (expired.length > 0) await this.ctx.storage.delete(expired.map((e) => e.code))

    const blocked = new Set<string>()
    if (ip) {
      for (const e of this.entries.values()) {
        if (e.blocked.length > 0 && e.blocked.includes(await addressKey(e.code, ip))) {
          blocked.add(e.code)
        }
      }
    }
    return openTables(this.entries.values(), now, (e) => blocked.has(e.code))
  }
}
