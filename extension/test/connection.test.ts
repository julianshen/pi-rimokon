import { describe, expect, it } from 'vitest'
import { type CommandFrame, PROTOCOL_VERSION } from '../src/protocol.ts'
import { type ConnectionOptions, type RawSocket, RemoteConnection } from '../src/connection.ts'

class FakeSocket implements RawSocket {
  sent: Array<Record<string, unknown>> = []
  closes: number[] = []
  private h: Record<string, ((arg?: unknown) => void)[]> = {}
  send(d: string) {
    this.sent.push(JSON.parse(d))
  }
  close(c?: number) {
    this.closes.push(c ?? 1000)
  }
  on(event: string, cb: (arg?: unknown) => void) {
    ;(this.h[event] ??= []).push(cb)
  }
  emit(event: string, arg?: unknown) {
    for (const cb of this.h[event] ?? []) cb(arg)
  }
}

const flush = () => new Promise((r) => setTimeout(r, 5))

function harness(over: Partial<ConnectionOptions> = {}) {
  const sockets: FakeSocket[] = []
  const statuses: string[] = []
  const commands: Array<{ frame: CommandFrame; reply: (p: Record<string, unknown>) => void }> = []
  const conn = new RemoteConnection({
    wsUrl: 'wss://srv.test',
    getToken: async () => 'tok-123',
    availability: () => ({ state: 'idle', cwd: '/work/app', repo: 'app', acceptTask: true }),
    onCommand: (frame, reply) => commands.push({ frame, reply }),
    onStatus: (s) => statuses.push(s.state),
    socketFactory: () => {
      const s = new FakeSocket()
      sockets.push(s)
      return s
    },
    reconnectMs: 5,
    ...over,
  })
  return { conn, sockets, statuses, commands }
}

describe('RemoteConnection', () => {
  it('sends hello with availability on open, then reports ready', async () => {
    const h = harness()
    h.conn.start()
    await flush()
    const s = h.sockets[0]
    s.emit('open')
    const hello = s.sent[0]
    expect(hello).toMatchObject({ type: 'hello', protocol: PROTOCOL_VERSION, state: 'idle', accept_task: true, agent: { repo: 'app' } })

    s.emit('message', JSON.stringify({ type: 'response', command: 'hello', success: true, data: { session_id: 'ses_1' } }))
    expect(h.statuses).toContain('ready')
    h.conn.stop()
  })

  it('tolerates a hello response with no session_id', async () => {
    const h = harness()
    h.conn.start()
    await flush()
    const s = h.sockets[0]
    s.emit('open')
    s.emit('message', JSON.stringify({ type: 'response', command: 'hello', success: true })) // no data
    expect(h.statuses).toContain('ready')
    h.conn.stop()
  })

  it('emits events only after the handshake', async () => {
    const h = harness()
    h.conn.start()
    await flush()
    const s = h.sockets[0]
    h.conn.sendEvent({ type: 'state', state: 'busy' }) // pre-ready → dropped
    expect(s.sent.filter((f) => f.type === 'state')).toHaveLength(0)
    s.emit('open')
    s.emit('message', JSON.stringify({ type: 'response', command: 'hello', success: true, data: { session_id: 'ses_1' } }))
    h.conn.sendEvent({ type: 'state', state: 'busy' })
    expect(s.sent.at(-1)).toEqual({ type: 'state', state: 'busy' })
    h.conn.stop()
  })

  it('dispatches an inbound command and correlates the response id', async () => {
    const h = harness()
    h.conn.start()
    await flush()
    const s = h.sockets[0]
    s.emit('open')
    s.emit('message', JSON.stringify({ type: 'response', command: 'hello', success: true, data: { session_id: 'ses_1' } }))
    s.emit('message', JSON.stringify({ type: 'steer', id: 'brk_9', message: 'go' }))
    expect(h.commands).toHaveLength(1)
    expect(h.commands[0].frame).toMatchObject({ type: 'steer', message: 'go' })
    h.commands[0].reply({ success: true })
    expect(s.sent.at(-1)).toEqual({ type: 'response', command: 'steer', id: 'brk_9', success: true })
    h.conn.stop()
  })

  it('uses default socket/reconnect options when omitted', () => {
    // constructing without socketFactory/reconnectMs exercises the ?? fallbacks;
    // not started, so no real socket is opened.
    const c = new RemoteConnection({
      wsUrl: 'wss://x',
      getToken: async () => 't',
      availability: () => ({ state: 'idle', acceptTask: true }),
      onCommand: () => {},
    })
    expect(c).toBeInstanceOf(RemoteConnection)
  })

  it('ignores commands until a successful handshake', async () => {
    const h = harness()
    h.conn.start()
    await flush()
    const s = h.sockets[0]
    s.emit('open')
    s.emit('message', JSON.stringify({ type: 'steer', id: 'x', message: 'early' })) // pre-handshake
    expect(h.commands).toHaveLength(0)
    s.emit('message', JSON.stringify({ type: 'response', command: 'hello', success: false })) // failed
    expect(h.statuses).not.toContain('ready')
    s.emit('message', JSON.stringify({ type: 'steer', id: 'y', message: 'still' })) // still unauthed
    expect(h.commands).toHaveLength(0)
    h.conn.stop()
  })

  it('drops oversized frames before parsing', async () => {
    const h = harness()
    h.conn.start()
    await flush()
    const s = h.sockets[0]
    s.emit('open')
    s.emit('message', JSON.stringify({ type: 'response', command: 'hello', success: true, data: { session_id: 's' } }))
    s.emit('message', JSON.stringify({ type: 'steer', id: 'z', message: 'a'.repeat(1024 * 1024 + 16) }))
    expect(h.commands).toHaveLength(0) // over 1 MiB → dropped, never dispatched
    h.conn.stop()
  })

  it('reconnects after a close (new socket)', async () => {
    const h = harness()
    h.conn.start()
    await flush()
    h.sockets[0].emit('open')
    h.sockets[0].emit('close') // no code → covers the undefined-code branch too
    await new Promise((r) => setTimeout(r, 20))
    expect(h.sockets.length).toBeGreaterThanOrEqual(2)
    expect(h.statuses).toContain('reconnecting')
    h.conn.stop()
  })

  it('stop() closes the socket and prevents reconnect', async () => {
    const h = harness()
    h.conn.start()
    await flush()
    h.sockets[0].emit('open')
    h.conn.stop()
    h.sockets[0].emit('close', 1000)
    await new Promise((r) => setTimeout(r, 20))
    expect(h.sockets).toHaveLength(1)
    expect(h.statuses).toContain('stopped')
  })

  it('reconnects when getToken fails', async () => {
    let calls = 0
    const h = harness({ getToken: async () => { calls++; if (calls === 1) throw new Error('no auth'); return 'tok' } })
    h.conn.start()
    await new Promise((r) => setTimeout(r, 20))
    expect(calls).toBeGreaterThanOrEqual(2)
    expect(h.statuses).toContain('reconnecting')
    h.conn.stop()
  })
})
