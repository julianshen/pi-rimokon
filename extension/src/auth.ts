import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface Credentials {
  accessToken: string
  refreshToken: string
  obtainedAt: number // epoch seconds
  expiresIn: number // seconds
}

export interface DeviceCode {
  deviceCode: string
  userCode: string
  verificationUri: string
  verificationUriComplete: string
  expiresIn: number
  interval: number
}

/** Persists the agent token across sessions. */
export interface CredentialStore {
  load(): Promise<Credentials | null>
  save(c: Credentials): Promise<void>
}

export interface AuthDeps {
  fetchFn?: typeof fetch
  now?: () => number // epoch seconds
  sleep?: (ms: number) => Promise<void>
}

/* v8 ignore start -- real runtime defaults (fetch / clock / timer); tests inject */
function resolveDeps(d: AuthDeps): Required<AuthDeps> {
  return {
    fetchFn: d.fetchFn ?? ((...a) => fetch(...a)),
    now: d.now ?? (() => Math.floor(Date.now() / 1000)),
    sleep: d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
  }
}
/* v8 ignore stop */

/** A file-backed credential store (0600), created on first save. */
export function fileCredentialStore(path: string): CredentialStore {
  return {
    async load() {
      try {
        return JSON.parse(await readFile(path, 'utf8')) as Credentials
      } catch {
        return null
      }
    },
    async save(c) {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(c, null, 2), { mode: 0o600 })
      await chmod(path, 0o600)
    },
  }
}

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

async function postForm(
  fetchFn: typeof fetch,
  httpBase: string,
  path: string,
  params: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetchFn(`${httpBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, body }
}

/** `POST /oauth/device/code` — start the device authorization grant. */
export async function requestDeviceCode(
  httpBase: string,
  clientId: string,
  deps: AuthDeps = {},
): Promise<DeviceCode> {
  const { fetchFn } = resolveDeps(deps)
  const { status, body } = await postForm(fetchFn, httpBase, '/oauth/device/code', {
    client_id: clientId,
    scope: 'agent',
  })
  if (status !== 200) throw new Error(`device/code failed (${status})`)
  return {
    deviceCode: String(body.device_code),
    userCode: String(body.user_code),
    verificationUri: String(body.verification_uri),
    verificationUriComplete: String(body.verification_uri_complete),
    expiresIn: Number(body.expires_in),
    interval: Number(body.interval),
  }
}

function credsFrom(body: Record<string, unknown>, now: number): Credentials {
  return {
    accessToken: String(body.access_token),
    refreshToken: String(body.refresh_token),
    obtainedAt: now,
    expiresIn: Number(body.expires_in ?? 3600),
  }
}

/**
 * Poll `POST /oauth/device/token` until the user approves (or it is denied /
 * expires). Honors `slow_down` by widening the interval (spec §3.1).
 */
export async function pollForToken(
  httpBase: string,
  clientId: string,
  code: DeviceCode,
  deps: AuthDeps = {},
): Promise<Credentials> {
  const { fetchFn, now, sleep } = resolveDeps(deps)
  const deadline = now() + code.expiresIn
  let intervalSec = code.interval

  for (;;) {
    if (now() >= deadline) throw new Error('device code expired before approval')
    await sleep(intervalSec * 1000)
    const { status, body } = await postForm(fetchFn, httpBase, '/oauth/device/token', {
      grant_type: DEVICE_GRANT,
      device_code: code.deviceCode,
      client_id: clientId,
    })
    if (status === 200) return credsFrom(body, now())
    switch (body.error) {
      case 'authorization_pending':
        break
      case 'slow_down':
        intervalSec += 5
        break
      case 'access_denied':
        throw new Error('authorization denied')
      default:
        throw new Error(`device/token failed: ${String(body.error ?? status)}`)
    }
  }
}

/** Exchange a refresh token for a fresh access token (rotating). */
export async function refresh(
  httpBase: string,
  clientId: string,
  refreshToken: string,
  deps: AuthDeps = {},
): Promise<Credentials> {
  const { fetchFn, now } = resolveDeps(deps)
  const { status, body } = await postForm(fetchFn, httpBase, '/oauth/device/token', {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  })
  if (status !== 200) throw new Error(`refresh failed (${String(body.error ?? status)})`)
  return credsFrom(body, now())
}

/** Seconds of headroom before expiry at which we proactively refresh. */
const REFRESH_SKEW = 60

/**
 * Return a valid access token: reuse the cached one, else refresh, else run the
 * device flow (showing the code via `presentCode`). Persists what it obtains.
 */
export async function ensureToken(
  args: { httpBase: string; clientId: string; store: CredentialStore; presentCode: (c: DeviceCode) => void },
  deps: AuthDeps = {},
): Promise<string> {
  const { now } = resolveDeps(deps)
  const cached = await args.store.load()
  if (cached && now() < cached.obtainedAt + cached.expiresIn - REFRESH_SKEW) {
    return cached.accessToken
  }
  if (cached?.refreshToken) {
    try {
      const rotated = await refresh(args.httpBase, args.clientId, cached.refreshToken, deps)
      await args.store.save(rotated)
      return rotated.accessToken
    } catch {
      // fall through to a fresh device-flow login
    }
  }
  const code = await requestDeviceCode(args.httpBase, args.clientId, deps)
  args.presentCode(code)
  const creds = await pollForToken(args.httpBase, args.clientId, code, deps)
  await args.store.save(creds)
  return creds.accessToken
}
