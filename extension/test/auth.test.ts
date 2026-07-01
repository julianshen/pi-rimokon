import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type Credentials,
  type CredentialStore,
  ensureToken,
  fileCredentialStore,
  pollForToken,
  refresh,
  requestDeviceCode,
} from '../src/auth.ts'

const HTTP = 'https://srv.test'

/** A fetch stub that returns queued {status, body} responses in order. */
function fetchQueue(responses: Array<{ status: number; body: Record<string, unknown> }>) {
  const q = [...responses]
  return vi.fn(async () => {
    const r = q.shift() ?? { status: 500, body: {} }
    return { status: r.status, json: async () => r.body } as unknown as Response
  })
}

function memStore(initial: Credentials | null = null): CredentialStore & { current: Credentials | null } {
  return {
    current: initial,
    async load() {
      return this.current
    },
    async save(c) {
      this.current = c
    },
  }
}

const noSleep = () => Promise.resolve()

describe('fileCredentialStore', () => {
  const dirs: string[] = []
  afterEach(async () => {
    for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true })
  })

  it('returns null when the file is absent, then round-trips + chmods 600', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-rc-'))
    dirs.push(dir)
    const path = join(dir, 'sub', 'credentials.json')
    const store = fileCredentialStore(path)
    expect(await store.load()).toBeNull()

    const creds: Credentials = { accessToken: 'A', refreshToken: 'R', obtainedAt: 1, expiresIn: 3600 }
    await store.save(creds)
    expect(await store.load()).toEqual(creds)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect(JSON.parse(await readFile(path, 'utf8')).accessToken).toBe('A')
  })
})

describe('requestDeviceCode', () => {
  it('parses the device/code response', async () => {
    const fetchFn = fetchQueue([
      {
        status: 200,
        body: {
          device_code: 'dc', user_code: 'WDJB-MJHT', verification_uri: 'https://app/device',
          verification_uri_complete: 'https://app/device?code=WDJB-MJHT', expires_in: 900, interval: 5,
        },
      },
    ])
    const dc = await requestDeviceCode(HTTP, 'cli', { fetchFn })
    expect(dc).toMatchObject({ deviceCode: 'dc', userCode: 'WDJB-MJHT', interval: 5, expiresIn: 900 })
  })
})

describe('pollForToken', () => {
  const code = { deviceCode: 'dc', userCode: 'U', verificationUri: '', verificationUriComplete: '', expiresIn: 900, interval: 1 }

  it('polls through pending → slow_down → approved', async () => {
    const fetchFn = fetchQueue([
      { status: 400, body: { error: 'authorization_pending' } },
      { status: 400, body: { error: 'slow_down' } },
      { status: 200, body: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 } },
    ])
    const creds = await pollForToken(HTTP, 'cli', code, { fetchFn, sleep: noSleep, now: () => 1000 })
    expect(creds).toMatchObject({ accessToken: 'AT', refreshToken: 'RT', expiresIn: 3600 })
  })

  it('throws on access_denied', async () => {
    const fetchFn = fetchQueue([{ status: 400, body: { error: 'access_denied' } }])
    await expect(pollForToken(HTTP, 'cli', code, { fetchFn, sleep: noSleep, now: () => 1000 })).rejects.toThrow(/denied/)
  })

  it('throws on an unexpected token error', async () => {
    const fetchFn = fetchQueue([{ status: 400, body: { error: 'expired_token' } }])
    await expect(pollForToken(HTTP, 'cli', code, { fetchFn, sleep: noSleep, now: () => 1000 })).rejects.toThrow(/expired_token/)
  })

  it('throws when the code expires before approval', async () => {
    let t = 1000
    const fetchFn = fetchQueue([{ status: 400, body: { error: 'authorization_pending' } }])
    await expect(
      pollForToken(HTTP, 'cli', { ...code, expiresIn: 1 }, { fetchFn, sleep: noSleep, now: () => (t += 100) }),
    ).rejects.toThrow(/expired/)
  })
})

describe('refresh', () => {
  it('exchanges a refresh token', async () => {
    const fetchFn = fetchQueue([{ status: 200, body: { access_token: 'A2', refresh_token: 'R2', expires_in: 3600 } }])
    expect(await refresh(HTTP, 'cli', 'R1', { fetchFn, now: () => 5 })).toMatchObject({ accessToken: 'A2', refreshToken: 'R2' })
  })
  it('throws on failure', async () => {
    const fetchFn = fetchQueue([{ status: 400, body: { error: 'invalid_grant' } }])
    await expect(refresh(HTTP, 'cli', 'bad', { fetchFn })).rejects.toThrow(/invalid_grant/)
  })
})

describe('ensureToken', () => {
  const base = { httpBase: HTTP, clientId: 'cli', presentCode: () => {} }

  it('returns a still-valid cached token without any network call', async () => {
    const store = memStore({ accessToken: 'CACHED', refreshToken: 'R', obtainedAt: 1000, expiresIn: 3600 })
    const fetchFn = vi.fn()
    const tok = await ensureToken({ ...base, store }, { fetchFn: fetchFn as unknown as typeof fetch, now: () => 1100 })
    expect(tok).toBe('CACHED')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('refreshes when the cached token is expired', async () => {
    const store = memStore({ accessToken: 'OLD', refreshToken: 'R1', obtainedAt: 0, expiresIn: 3600 })
    const fetchFn = fetchQueue([{ status: 200, body: { access_token: 'NEW', refresh_token: 'R2', expires_in: 3600 } }])
    const tok = await ensureToken({ ...base, store }, { fetchFn, now: () => 100000 })
    expect(tok).toBe('NEW')
    expect(store.current?.refreshToken).toBe('R2')
  })

  it('runs the device flow when there are no credentials', async () => {
    const store = memStore(null)
    const presentCode = vi.fn()
    const fetchFn = fetchQueue([
      { status: 200, body: { device_code: 'dc', user_code: 'U', verification_uri: 'v', verification_uri_complete: 'vc', expires_in: 900, interval: 1 } },
      { status: 200, body: { access_token: 'FRESH', refresh_token: 'RT', expires_in: 3600 } },
    ])
    const tok = await ensureToken({ ...base, store, presentCode }, { fetchFn, sleep: noSleep, now: () => 1000 })
    expect(tok).toBe('FRESH')
    expect(presentCode).toHaveBeenCalledOnce()
    expect(store.current?.accessToken).toBe('FRESH')
  })

  it('falls back to the device flow when refresh fails', async () => {
    const store = memStore({ accessToken: 'OLD', refreshToken: 'BAD', obtainedAt: 0, expiresIn: 10 })
    const fetchFn = fetchQueue([
      { status: 400, body: { error: 'invalid_grant' } }, // refresh fails
      { status: 200, body: { device_code: 'dc', user_code: 'U', verification_uri: 'v', verification_uri_complete: 'vc', expires_in: 900, interval: 1 } },
      { status: 200, body: { access_token: 'VIA_DEVICE', refresh_token: 'RT', expires_in: 3600 } },
    ])
    const tok = await ensureToken({ ...base, store }, { fetchFn, sleep: noSleep, now: () => 100000 })
    expect(tok).toBe('VIA_DEVICE')
  })
})
