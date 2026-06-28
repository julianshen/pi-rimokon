import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.ts'
import { PROTOCOL_VERSION } from '../../shared/protocol.ts'

describe('GET /healthz', () => {
  it('returns 200 with status ok and the protocol version', async () => {
    const res = await request(createApp()).get('/healthz')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', protocol: PROTOCOL_VERSION })
  })

  it('does not leak the x-powered-by header', async () => {
    const res = await request(createApp()).get('/healthz')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})
