import { beforeEach, describe, expect, it } from 'vitest'
import { CLOSE_CODES, MAX_FRAME_BYTES } from '../../shared/protocol.ts'
import { agentTokens, agentSessions } from '../src/db/repositories.ts'
import { Broker } from '../src/broker/registry.ts'
import { handleAgentConnection } from '../src/ws/agent.ts'
import { FakeSocket, flush } from './fakeSocket.ts'
import { issueAgentAccess, makeHarness, TEST_USER } from './helpers.ts'

let h: Awaited<ReturnType<typeof makeHarness>>
let hub: Broker

beforeEach(async () => {
  h = await makeHarness()
  hub = new Broker()
})

const HELLO = { type: 'hello', id: 'h1', protocol: 'pi.rpc/1', accept_task: true, agent: { repo: 'acme/web' } }

function connect(socket: FakeSocket, opts: Parameters<typeof handleAgentConnection>[3] = {}) {
  handleAgentConnection(h.ctx, hub, socket, { handshakeMs: 1000, heartbeatMs: 1000, ...opts })
}

describe('/agent handshake', () => {
  it('authenticates with a header token, creates a session, and sends ready', async () => {
    const { token, jti } = await issueAgentAccess(h)
    const socket = new FakeSocket()
    connect(socket, { headerToken: token })
    socket.deliver(HELLO)
    await flush()

    const [resp, ready] = socket.frames()
    expect(resp).toMatchObject({ type: 'response', command: 'hello', id: 'h1', success: true })
    expect(ready).toMatchObject({ type: 'ready' })
    const sessionId = (resp.data as { session_id: string }).session_id

    expect(hub.getAgent(sessionId)?.userId).toBe(TEST_USER)
    expect(hub.getAgent(sessionId)?.availability.acceptTask).toBe(true)
    const row = await agentSessions.findById(h.ctx.db, sessionId)
    expect(row).toMatchObject({ user_id: TEST_USER, jti, repo: 'acme/web', status: 'started' })
  })

  it('accepts a token supplied in the hello frame (header fallback)', async () => {
    const { token } = await issueAgentAccess(h)
    const socket = new FakeSocket()
    connect(socket)
    socket.deliver({ ...HELLO, token })
    await flush()
    expect(socket.frames()[0]).toMatchObject({ success: true })
    expect(socket.lastClose).toBeUndefined()
  })

  it('rejects an invalid token with 4401', async () => {
    const socket = new FakeSocket()
    connect(socket, { headerToken: 'not-a-jwt' })
    socket.deliver(HELLO)
    await flush()
    expect(socket.lastClose).toBe(CLOSE_CODES.UNAUTHORIZED)
  })

  it('rejects a missing token with 4401', async () => {
    const socket = new FakeSocket()
    connect(socket)
    socket.deliver(HELLO) // no header, no hello.token
    await flush()
    expect(socket.lastClose).toBe(CLOSE_CODES.UNAUTHORIZED)
  })

  it('rejects a revoked token with 4403', async () => {
    const { token, familyId } = await issueAgentAccess(h)
    await agentTokens.revokeFamily(h.ctx.db, familyId, new Date(h.clock.value * 1000))
    const socket = new FakeSocket()
    connect(socket, { headerToken: token })
    socket.deliver(HELLO)
    await flush()
    expect(socket.lastClose).toBe(CLOSE_CODES.FORBIDDEN)
  })

  it('rejects a protocol-major mismatch with 4400 and a failure response', async () => {
    const { token } = await issueAgentAccess(h)
    const socket = new FakeSocket()
    connect(socket, { headerToken: token })
    socket.deliver({ ...HELLO, protocol: 'pi.rpc/2' })
    await flush()
    expect(socket.frames()[0]).toMatchObject({ command: 'hello', success: false })
    expect(socket.lastClose).toBe(CLOSE_CODES.PROTOCOL_ERROR)
  })

  it('rejects a non-hello first frame with 4400', async () => {
    const socket = new FakeSocket()
    connect(socket, { headerToken: 'x' })
    socket.deliver({ type: 'steer', text: 'go' })
    await flush()
    expect(socket.lastClose).toBe(CLOSE_CODES.PROTOCOL_ERROR)
  })

  it('rejects a binary frame with 4400', async () => {
    const socket = new FakeSocket()
    connect(socket, { headerToken: 'x' })
    socket.deliver('binary-bytes', true)
    await flush()
    expect(socket.lastClose).toBe(CLOSE_CODES.PROTOCOL_ERROR)
  })

  it('rejects an oversized frame with 4413', async () => {
    const socket = new FakeSocket()
    connect(socket, { headerToken: 'x' })
    socket.deliver(`{"x":"${'a'.repeat(MAX_FRAME_BYTES)}"}`)
    await flush()
    expect(socket.lastClose).toBe(CLOSE_CODES.TOO_LARGE)
  })

  it('closes with 4408 when the handshake does not complete in time', async () => {
    const socket = new FakeSocket()
    connect(socket, { headerToken: 'x', handshakeMs: 20 })
    await flush(50)
    expect(socket.lastClose).toBe(CLOSE_CODES.TIMEOUT)
  })

  it('ignores extra frames during an in-flight handshake (no double session)', async () => {
    const { token } = await issueAgentAccess(h)
    const socket = new FakeSocket()
    connect(socket, { headerToken: token })
    // two hellos delivered synchronously, before the first handshake settles
    socket.deliver(HELLO)
    socket.deliver({ ...HELLO, id: 'h2' })
    await flush()
    expect(hub.listAgentsByUser(TEST_USER)).toHaveLength(1)
    expect(socket.lastClose).toBeUndefined()
  })

  it('closes with 1011 when the handshake hits an unexpected error', async () => {
    const { token } = await issueAgentAccess(h)
    // Break the DB so agentTokens.isActive throws after the token verifies.
    const brokenCtx = { ...h.ctx, db: { query: () => Promise.reject(new Error('boom')) } }
    const socket = new FakeSocket()
    handleAgentConnection(brokenCtx, hub, socket, { headerToken: token, handshakeMs: 1000 })
    socket.deliver(HELLO)
    await flush()
    expect(socket.lastClose).toBe(CLOSE_CODES.INTERNAL)
  })

  it('rebinds a resume to a fresh session (v1: no replay)', async () => {
    const { token } = await issueAgentAccess(h)
    const socket = new FakeSocket()
    connect(socket, { headerToken: token })
    socket.deliver({ type: 'resume', id: 'r1', session_id: 'ses_old', last_seq: 3 })
    await flush()
    const resp = socket.frames()[0]
    expect(resp).toMatchObject({ type: 'response', command: 'resume', success: true })
    expect((resp.data as { session_id: string }).session_id).not.toBe('ses_old')
  })
})

describe('/agent session lifecycle', () => {
  it('tracks the event seq high-water mark and ends the session on close', async () => {
    const { token } = await issueAgentAccess(h)
    const socket = new FakeSocket()
    connect(socket, { headerToken: token })
    socket.deliver(HELLO)
    await flush()
    const sessionId = (socket.frames()[0].data as { session_id: string }).session_id

    // Events carry no seq; the server stamps a per-session monotonic value.
    socket.deliver({ type: 'tool_update' })
    socket.deliver({ type: 'tool_update' })
    socket.deliver({ type: 'response', command: 'steer', id: 'c1', success: true }) // not sequenced
    socket.close(CLOSE_CODES.NORMAL)
    await flush()

    expect(hub.getAgent(sessionId)).toBeUndefined()
    const row = await agentSessions.findById(h.ctx.db, sessionId)
    expect(row).toMatchObject({ status: 'ended', last_seq: 2 })
    expect(row?.ended_at).toBeTruthy()
  })

  it('closes with 4408 after missed heartbeats', async () => {
    const { token } = await issueAgentAccess(h)
    const socket = new FakeSocket()
    connect(socket, { headerToken: token, heartbeatMs: 20 })
    socket.deliver(HELLO)
    await flush()
    // never pong → after >2× heartbeat the keepalive closes it
    await flush(80)
    expect(socket.lastClose).toBe(CLOSE_CODES.TIMEOUT)
    expect(socket.pings).toBeGreaterThan(0)
  })

  it('does not register a session if the socket closes mid-handshake', async () => {
    const { token } = await issueAgentAccess(h)
    const socket = new FakeSocket()
    connect(socket, { headerToken: token })
    socket.deliver(HELLO) // starts the async handshake (parked on the first await)
    socket.close(CLOSE_CODES.NORMAL) // peer disconnects before it settles
    await flush()

    expect(hub.listAgentsByUser(TEST_USER)).toHaveLength(0)
    expect(socket.frames().some((f) => f.type === 'ready')).toBe(false)
    expect(socket.pings).toBe(0) // no leaked heartbeat
  })

  it('closes with 4403 when the family is revoked mid-handshake (re-check)', async () => {
    const { token } = await issueAgentAccess(h)
    // isActive: active on the pre-register check, revoked on the post-register
    // re-check — simulating a revoke that lands during the handshake await.
    let activeChecks = 0
    const realQuery = h.ctx.db.query.bind(h.ctx.db)
    const racingDb = {
      query: (text: string, params?: unknown[]) => {
        if (text.includes('revoked_at IS NULL')) {
          activeChecks += 1
          return Promise.resolve({ rows: [{ active: activeChecks === 1 }] })
        }
        return realQuery(text, params)
      },
    } as unknown as typeof h.ctx.db
    const socket = new FakeSocket()
    handleAgentConnection({ ...h.ctx, db: racingDb }, hub, socket, { headerToken: token })
    socket.deliver(HELLO)
    await flush()
    expect(activeChecks).toBe(2)
    expect(socket.lastClose).toBe(CLOSE_CODES.FORBIDDEN)
    expect(hub.listAgentsByUser(TEST_USER)).toHaveLength(0) // not left registered
  })

  it('tears down a live socket when its token family is revoked (4403)', async () => {
    const { token, familyId } = await issueAgentAccess(h)
    // wire the revocation hook as index.ts does
    h.ctx.onFamilyRevoked = (fam) => hub.closeFamily(fam, CLOSE_CODES.FORBIDDEN)
    const socket = new FakeSocket()
    connect(socket, { headerToken: token })
    socket.deliver(HELLO)
    await flush()

    hub.closeFamily(familyId, CLOSE_CODES.FORBIDDEN)
    expect(socket.lastClose).toBe(CLOSE_CODES.FORBIDDEN)
  })
})
