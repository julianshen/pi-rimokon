import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.ts'
import { agentTokens } from '../src/db/repositories.ts'
import { makeHarness, TEST_USER } from './helpers.ts'

const OTHER_USER = '22222222-2222-2222-2222-222222222222'

async function seedToken(
  h: Awaited<ReturnType<typeof makeHarness>>,
  over: { jti: string; familyId: string; userId?: string; label?: string },
) {
  await agentTokens.insert(h.ctx.db, {
    jti: over.jti,
    familyId: over.familyId,
    userId: over.userId ?? TEST_USER,
    scopes: ['agent'],
    label: over.label,
  })
}

describe('GET /agent/tokens', () => {
  it('lists the signed-in user’s tokens only', async () => {
    const h = await makeHarness()
    await seedToken(h, { jti: 'j1', familyId: 'fam1', label: 'laptop' })
    await seedToken(h, { jti: 'j2', familyId: 'fam2' })
    await seedToken(h, { jti: 'j3', familyId: 'fam3', userId: OTHER_USER })

    const res = await request(createApp(h.ctx)).get('/agent/tokens').set('Authorization', 'Bearer valid')
    expect(res.status).toBe(200)
    expect(res.body.tokens).toHaveLength(2)
    expect(res.body.tokens.map((t: { family_id: string }) => t.family_id).sort()).toEqual(['fam1', 'fam2'])
  })

  it('requires a bearer token', async () => {
    const h = await makeHarness()
    expect((await request(createApp(h.ctx)).get('/agent/tokens')).status).toBe(401)
  })

  it('rejects an invalid Supabase token', async () => {
    const h = await makeHarness()
    const res = await request(createApp(h.ctx)).get('/agent/tokens').set('Authorization', 'Bearer bad')
    expect(res.status).toBe(401)
  })
})

describe('POST /agent/tokens/revoke', () => {
  it('revokes a family the user owns and tears down sockets', async () => {
    const h = await makeHarness()
    let torndown: string | undefined
    h.ctx.onFamilyRevoked = (fam) => {
      torndown = fam
    }
    await seedToken(h, { jti: 'j1', familyId: 'fam1' })

    const res = await request(createApp(h.ctx))
      .post('/agent/tokens/revoke')
      .set('Authorization', 'Bearer valid')
      .send({ family_id: 'fam1' })
    expect(res.status).toBe(200)
    expect(torndown).toBe('fam1')
    expect(await agentTokens.isActive(h.ctx.db, 'j1')).toBe(false)
  })

  it('refuses to revoke a family owned by another user (404)', async () => {
    const h = await makeHarness()
    await seedToken(h, { jti: 'j3', familyId: 'fam3', userId: OTHER_USER })
    const res = await request(createApp(h.ctx))
      .post('/agent/tokens/revoke')
      .set('Authorization', 'Bearer valid')
      .send({ family_id: 'fam3' })
    expect(res.status).toBe(404)
    expect(await agentTokens.isActive(h.ctx.db, 'j3')).toBe(true) // untouched
  })

  it('404s on a missing family_id', async () => {
    const h = await makeHarness()
    const res = await request(createApp(h.ctx))
      .post('/agent/tokens/revoke')
      .set('Authorization', 'Bearer valid')
      .send({})
    expect(res.status).toBe(404)
  })
})
