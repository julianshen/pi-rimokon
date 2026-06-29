import { describe, it, expect, vi } from 'vitest'
import { type PiSocket, WebSocketPiService } from './WebSocketPiService'

class FakePiSocket implements PiSocket {
  sent: Array<Record<string, unknown>> = []
  closed = false
  onopen: ((ev?: unknown) => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: ((ev?: unknown) => void) | null = null
  send(data: string) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    this.closed = true
  }
}

const flush = (ms = 5) => new Promise((r) => setTimeout(r, ms))

interface Harness {
  svc: WebSocketPiService
  sockets: FakePiSocket[]
  fetchMock: ReturnType<typeof vi.fn>
}

async function makeService(opts: { token?: string | null; reconnectMs?: number } = {}): Promise<Harness> {
  const sockets: FakePiSocket[] = []
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ticket: 'tk' }) }) as unknown as Response)
  const svc = new WebSocketPiService({
    serverUrl: 'wss://srv.test',
    getAccessToken: async () => (opts.token === undefined ? 'tok' : opts.token),
    socketFactory: (_url) => {
      const s = new FakePiSocket()
      sockets.push(s)
      return s
    },
    fetchFn: fetchMock,
    reconnectMs: opts.reconnectMs ?? 1,
  })
  await flush()
  return { svc, sockets, fetchMock }
}

/** Push a broker message into the most recently opened socket. */
function deliver(h: Harness, msg: Record<string, unknown>) {
  h.sockets.at(-1)?.onmessage?.({ data: JSON.stringify(msg) })
}

const SNAPSHOT = {
  type: 'sessions',
  sessions: [
    { session_id: 's1', repo: 'acme/web', state: 'idle', accept_task: true },
    { session_id: 's2', repo: 'acme/api', state: 'busy', accept_task: false },
  ],
}

describe('WebSocketPiService — connection', () => {
  it('fetches a ticket and opens the /client socket', async () => {
    const h = await makeService()
    expect(h.fetchMock).toHaveBeenCalledWith('https://srv.test/client/ticket', expect.objectContaining({ method: 'POST' }))
    expect(h.sockets).toHaveLength(1)
    h.svc.dispose()
  })

  it('does not open a socket when unauthenticated', async () => {
    const h = await makeService({ token: null })
    expect(h.sockets).toHaveLength(0)
    h.svc.dispose()
  })

  it('reconnects after the socket closes', async () => {
    const h = await makeService({ reconnectMs: 1 })
    h.sockets[0].onopen?.() // reset backoff
    h.sockets[0].onclose?.()
    await flush(15)
    expect(h.sockets.length).toBeGreaterThanOrEqual(2)
    h.svc.dispose()
  })

  it('stops reconnecting after dispose', async () => {
    const h = await makeService()
    h.svc.dispose()
    h.sockets[0].onclose?.()
    await flush(15)
    expect(h.sockets).toHaveLength(1)
  })
})

describe('WebSocketPiService — presence mapping', () => {
  it('maps a snapshot into the session list', async () => {
    const h = await makeService()
    deliver(h, SNAPSHOT)
    const sessions = h.svc.listSessions()
    expect(sessions.map((s) => s.id)).toEqual(['s1', 's2'])
    expect(h.svc.getSession('s2')?.live).toBe(true)
    expect(h.svc.getSession('s1')?.status).toBe('review')
    h.svc.dispose()
  })

  it('handles online/offline/agent_state', async () => {
    const h = await makeService()
    deliver(h, { type: 'session_online', session_id: 's3', repo: 'r', state: 'idle' })
    expect(h.svc.getSession('s3')).toBeDefined()
    deliver(h, { type: 'agent_state', session_id: 's3', state: 'busy' })
    expect(h.svc.getSession('s3')?.live).toBe(true)
    deliver(h, { type: 'session_offline', session_id: 's3' })
    expect(h.svc.getSession('s3')).toBeUndefined()
    h.svc.dispose()
  })

  it('folds an event with text into the session thread; ignores bad JSON', async () => {
    const h = await makeService()
    deliver(h, SNAPSHOT)
    deliver(h, { type: 'agent_message', session_id: 's1', message: 'hello there' })
    expect(h.svc.getSession('s1')?.thread.at(-1)).toMatchObject({ role: 'agent', text: 'hello there' })
    h.sockets.at(-1)?.onmessage?.({ data: '{bad json' }) // no throw
    deliver(h, { type: 'response', id: 'c1', success: true }) // ack: no-op
    h.svc.dispose()
  })
})

describe('WebSocketPiService — commands', () => {
  it('startSession selects an idle agent and sends a prompt', async () => {
    const h = await makeService()
    deliver(h, SNAPSHOT)
    const sess = h.svc.startSession({ prompt: 'do it', repo: 'acme/web', model: 'pi', skills: {} })
    expect(sess.id).toBe('s1')
    expect(h.sockets.at(-1)?.sent.at(-1)).toMatchObject({ type: 'start_session', prompt: 'do it', session_id: 's1' })
    h.svc.dispose()
  })

  it('startSession surfaces a notice when no idle agent matches', async () => {
    const h = await makeService()
    deliver(h, SNAPSHOT) // s1 idle but repo acme/web; ask for a different repo
    const sess = h.svc.startSession({ prompt: 'hi', repo: 'no/such', model: 'pi', skills: {} })
    expect(sess.id).toMatch(/^local_/)
    expect(h.svc.getSession(sess.id)?.thread.at(-1)?.text).toMatch(/No connected agent/)
    expect(h.svc.listSessions().some((s) => s.id === sess.id)).toBe(true)
    h.svc.dispose()
  })

  it('sendMessage, pickOption, stopRun emit addressed frames', async () => {
    const h = await makeService()
    deliver(h, SNAPSHOT)
    h.svc.sendMessage('s1', 'steer this', { steer: true })
    expect(h.sockets.at(-1)?.sent.at(-1)).toMatchObject({ type: 'steer', session_id: 's1', message: 'steer this' })
    expect(h.svc.getSession('s1')?.thread.at(-1)).toMatchObject({ role: 'user', text: 'steer this' })
    h.svc.pickOption('s1', 'option-a')
    expect(h.sockets.at(-1)?.sent.at(-1)).toMatchObject({ type: 'pick_option', option: 'option-a' })
    h.svc.stopRun('s1')
    expect(h.sockets.at(-1)?.sent.at(-1)).toMatchObject({ type: 'stop', session_id: 's1' })
    h.svc.dispose()
  })

  it('notifies subscribers on store changes', async () => {
    const h = await makeService()
    const listener = vi.fn()
    const unsub = h.svc.subscribe(listener)
    deliver(h, SNAPSHOT)
    expect(listener).toHaveBeenCalled()
    unsub()
    h.svc.dispose()
  })
})
