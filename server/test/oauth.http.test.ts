import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.ts'
import { makeHarness, TEST_USER } from './helpers.ts'

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

describe('OAuth HTTP routes', () => {
  it('serves the JWKS with the signing key', async () => {
    const h = await makeHarness()
    const res = await request(createApp(h.ctx)).get('/.well-known/jwks.json')
    expect(res.status).toBe(200)
    expect(res.body.keys).toHaveLength(1)
    expect(res.body.keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig', kid: h.ctx.keys.kid })
  })

  it('drives the full device flow over HTTP', async () => {
    const h = await makeHarness()
    const app = createApp(h.ctx)

    // 1. device/code (form-encoded)
    const code = await request(app)
      .post('/oauth/device/code')
      .type('form')
      .send({ client_id: 'pi-agent-cli', scope: 'agent' })
    expect(code.status).toBe(200)
    expect(code.body.user_code).toMatch(/-/)
    expect(code.body.verification_uri_complete).toContain(code.body.user_code)

    // 2. poll before approval → 400 authorization_pending
    const pending = await request(app)
      .post('/oauth/device/token')
      .type('form')
      .send({ grant_type: DEVICE_GRANT, client_id: 'pi-agent-cli', device_code: code.body.device_code })
    expect(pending.status).toBe(400)
    expect(pending.body.error).toBe('authorization_pending')

    // 3. approve (JSON + Supabase bearer)
    const approve = await request(app)
      .post('/oauth/device/approve')
      .set('Authorization', 'Bearer valid')
      .send({ user_code: code.body.user_code, decision: 'approve' })
    expect(approve.status).toBe(200)
    expect(approve.body.status).toBe('approved')

    // advance past the poll interval to avoid slow_down, then exchange
    h.clock.tick(h.ctx.ttl.pollIntervalSec + 1)
    const token = await request(app)
      .post('/oauth/device/token')
      .type('form')
      .send({ grant_type: DEVICE_GRANT, client_id: 'pi-agent-cli', device_code: code.body.device_code })
    expect(token.status).toBe(200)
    expect(token.body.access_token).toBeTruthy()
    expect(token.body.refresh_token).toBeTruthy()

    // 4. revoke
    const revoke = await request(app)
      .post('/oauth/revoke')
      .type('form')
      .send({ token: token.body.refresh_token })
    expect(revoke.status).toBe(200)
  })

  it('rejects device/approve without a bearer token (401)', async () => {
    const h = await makeHarness()
    const res = await request(createApp(h.ctx))
      .post('/oauth/device/approve')
      .send({ user_code: 'WDJB-MJHT', decision: 'approve' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid_token')
  })

  it('maps an unexpected error to 500 server_error', async () => {
    const h = await makeHarness()
    const brokenCtx = {
      ...h.ctx,
      db: { query: () => Promise.reject(new Error('boom')) },
    }
    const res = await request(createApp(brokenCtx))
      .post('/oauth/device/code')
      .type('form')
      .send({ client_id: 'cli' })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('server_error')
  })

  it('maps a non-auth failure during approve to 500 (not 401)', async () => {
    const h = await makeHarness()
    // Supabase verification succeeds, but the DB lookup afterwards blows up.
    const brokenCtx = {
      ...h.ctx,
      verifySupabaseToken: async () => ({ sub: TEST_USER }),
      db: { query: () => Promise.reject(new Error('boom')) },
    }
    const res = await request(createApp(brokenCtx))
      .post('/oauth/device/approve')
      .set('Authorization', 'Bearer whatever')
      .send({ user_code: 'WDJB-MJHT', decision: 'approve' })
    expect(res.status).toBe(500)
  })

  it('answers CORS preflight and sets the allowed origin', async () => {
    const h = await makeHarness()
    const app = createApp({ ...h.ctx, allowedOrigin: 'https://app.test' })

    const preflight = await request(app).options('/oauth/device/approve')
    expect(preflight.status).toBe(204)
    expect(preflight.headers['access-control-allow-origin']).toBe('https://app.test')

    const jwks = await request(app).get('/.well-known/jwks.json')
    expect(jwks.headers['access-control-allow-origin']).toBe('https://app.test')
  })

  it('maps an invalid Supabase token to 401', async () => {
    const h = await makeHarness()
    const app = createApp(h.ctx)
    const code = await request(app)
      .post('/oauth/device/code')
      .type('form')
      .send({ client_id: 'cli' })
    const res = await request(app)
      .post('/oauth/device/approve')
      .set('Authorization', 'Bearer bad')
      .send({ user_code: code.body.user_code, decision: 'approve' })
    expect(res.status).toBe(401)
  })
})
