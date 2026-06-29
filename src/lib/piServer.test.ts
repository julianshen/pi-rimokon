import { describe, it, expect, vi, beforeEach } from 'vitest'

const mock = vi.hoisted(() => ({
  session: null as { access_token: string } | null,
}))

vi.mock('./supabase', () => ({
  get supabase() {
    return {
      auth: { getSession: vi.fn(async () => ({ data: { session: mock.session } })) },
    }
  },
}))

import { piAccessToken, toHttpBase } from './piServer'

beforeEach(() => {
  mock.session = null
})

describe('toHttpBase', () => {
  it('swaps the ws scheme for http and trims a trailing slash', () => {
    expect(toHttpBase('wss://srv.test')).toBe('https://srv.test')
    expect(toHttpBase('ws://localhost:8787/')).toBe('http://localhost:8787')
  })

  it('returns undefined when unset', () => {
    expect(toHttpBase(undefined)).toBeUndefined()
  })
})

describe('piAccessToken', () => {
  it('returns the access token when signed in', async () => {
    mock.session = { access_token: 'tok-123' }
    expect(await piAccessToken()).toBe('tok-123')
  })

  it('returns null when there is no session', async () => {
    expect(await piAccessToken()).toBeNull()
  })
})
