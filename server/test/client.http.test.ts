import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.ts'
import { TicketStore } from '../src/broker/tickets.ts'
import { makeHarness, TEST_USER } from './helpers.ts'

function withTickets(h: Awaited<ReturnType<typeof makeHarness>>) {
  const tickets = new TicketStore(() => h.clock.value, h.ctx.ttl.ticketSec)
  return { tickets, app: createApp(h.ctx, tickets) }
}

describe('POST /client/ticket', () => {
  it('issues a single-use ticket for an authenticated Supabase user', async () => {
    const h = await makeHarness()
    const { tickets, app } = withTickets(h)
    const res = await request(app).post('/client/ticket').set('Authorization', 'Bearer valid')
    expect(res.status).toBe(200)
    expect(res.body.expires_in).toBe(h.ctx.ttl.ticketSec)
    expect(res.body.ticket).toBeTruthy()

    // redeemable exactly once, for the right user
    expect(tickets.redeem(res.body.ticket)).toBe(TEST_USER)
    expect(tickets.redeem(res.body.ticket)).toBeUndefined()
  })

  it('rejects a missing bearer token with 401', async () => {
    const h = await makeHarness()
    const { app } = withTickets(h)
    const res = await request(app).post('/client/ticket')
    expect(res.status).toBe(401)
  })

  it('rejects an invalid Supabase token with 401', async () => {
    const h = await makeHarness()
    const { app } = withTickets(h)
    const res = await request(app).post('/client/ticket').set('Authorization', 'Bearer bad')
    expect(res.status).toBe(401)
  })

  it('maps an unexpected verifier error to 500', async () => {
    const h = await makeHarness()
    const tickets = new TicketStore(() => h.clock.value, h.ctx.ttl.ticketSec)
    const ctx = { ...h.ctx, verifySupabaseToken: () => Promise.reject(new Error('boom')) }
    const res = await request(createApp(ctx, tickets))
      .post('/client/ticket')
      .set('Authorization', 'Bearer x')
    expect(res.status).toBe(500)
  })
})

describe('TicketStore', () => {
  it('treats an expired ticket as invalid', () => {
    let t = 1000
    const store = new TicketStore(() => t, 30)
    const { ticket } = store.issue('u1')
    t = 1031 // past the 30s TTL
    expect(store.redeem(ticket)).toBeUndefined()
  })

  it('rejects an unknown ticket', () => {
    const store = new TicketStore(() => 0, 30)
    expect(store.redeem('nope')).toBeUndefined()
  })
})
