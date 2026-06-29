import { randomToken } from '../auth/tokens.ts'

interface TicketEntry {
  userId: string
  expiresAt: number // epoch seconds
}

/**
 * Short-lived, single-use `/client` connection tickets (spec §5.1). Browsers
 * can't set `Authorization` on a WS upgrade, so the SPA fetches a ticket over
 * HTTPS (authenticated by its Supabase JWT) and presents it on the socket URL.
 * In-memory for the single-instance v1.
 */
export class TicketStore {
  private readonly tickets = new Map<string, TicketEntry>()

  constructor(
    private readonly now: () => number,
    private readonly ttlSec: number,
  ) {}

  /** Issue a ticket bound to a user; returned to the SPA over HTTPS. */
  issue(userId: string): { ticket: string; expiresIn: number } {
    this.sweepExpired() // evict never-redeemed tickets so the map can't grow unbounded
    const ticket = randomToken()
    this.tickets.set(ticket, { userId, expiresAt: this.now() + this.ttlSec })
    return { ticket, expiresIn: this.ttlSec }
  }

  private sweepExpired(): void {
    const now = this.now()
    for (const [ticket, entry] of this.tickets) {
      if (now > entry.expiresAt) this.tickets.delete(ticket)
    }
  }

  /** Redeem (and burn) a ticket. Returns the bound user id, or undefined if
   *  unknown/already used/expired. Always single-use. */
  redeem(ticket: string): string | undefined {
    const entry = this.tickets.get(ticket)
    if (!entry) return undefined
    this.tickets.delete(ticket) // single-use: burn on first redemption
    if (this.now() > entry.expiresAt) return undefined
    return entry.userId
  }
}
