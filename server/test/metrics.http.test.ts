import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.ts'
import { Broker } from '../src/broker/registry.ts'

describe('GET /metrics', () => {
  it('exposes broker stats as JSON', async () => {
    const broker = new Broker()
    const res = await request(createApp(undefined, undefined, broker)).get('/metrics')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      agents_live: 0,
      clients_live: 0,
      agent_connections_total: 0,
      routing_errors_total: 0,
    })
  })

  it('is absent when no broker is wired', async () => {
    const res = await request(createApp()).get('/metrics')
    expect(res.status).toBe(404)
  })
})
