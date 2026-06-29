import { describe, expect, it } from 'vitest'
import { CLOSE_CODES } from '../../shared/protocol.ts'
import { type AgentSession, Broker, type ClosableSocket } from '../src/broker/registry.ts'
import { handleClientConnection } from '../src/ws/client.ts'
import { FakeSocket } from './fakeSocket.ts'

interface Sock extends ClosableSocket {
  sent: Array<Record<string, unknown>>
  closes: number[]
}
function sock(): Sock {
  const sent: Array<Record<string, unknown>> = []
  const closes: number[] = []
  return { sent, closes, send: (s) => sent.push(JSON.parse(s)), close: (c) => closes.push(c) }
}

function mkAgent(
  broker: Broker,
  over: Partial<AgentSession> & { sessionId: string; userId: string },
): Sock {
  const socket = sock()
  broker.registerAgent({
    jti: `jti_${over.sessionId}`,
    familyId: `fam_${over.sessionId}`,
    availability: { acceptTask: true, repo: 'acme/web' },
    state: 'idle',
    socket,
    ...over,
  })
  return socket
}

let clientCounter = 0
function mkClient(broker: Broker, userId: string): { id: string; socket: Sock } {
  const socket = sock()
  const id = `cli_${userId}_${(clientCounter += 1)}`
  broker.registerClient({ clientId: id, userId, socket })
  return { id, socket }
}

describe('Broker — presence & snapshot', () => {
  it('sends a sessions snapshot (with state) on client connect', () => {
    const broker = new Broker()
    mkAgent(broker, { sessionId: 's1', userId: 'u1', state: 'idle' })
    const { socket } = mkClient(broker, 'u1')
    expect(socket.sent[0]).toEqual({
      type: 'sessions',
      sessions: [
        { session_id: 's1', repo: 'acme/web', status: 'online', state: 'idle', accept_task: true },
      ],
    })
  })

  it('broadcasts session_online and session_offline to the user’s clients', () => {
    const broker = new Broker()
    const { socket } = mkClient(broker, 'u1')
    mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    expect(socket.sent.at(-1)).toMatchObject({ type: 'session_online', session_id: 's1' })
    broker.unregisterAgent('s1')
    expect(socket.sent.at(-1)).toMatchObject({ type: 'session_offline', session_id: 's1' })
  })

  it('broadcasts agent_state changes', () => {
    const broker = new Broker()
    mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    const { socket } = mkClient(broker, 'u1')
    broker.setAgentState('s1', 'busy')
    expect(socket.sent.at(-1)).toEqual({ type: 'agent_state', session_id: 's1', state: 'busy' })
  })
})

describe('Broker — routing', () => {
  it('forwards a client command to the right agent with a rewritten id', () => {
    const broker = new Broker()
    const agent = mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    const client = mkClient(broker, 'u1')

    broker.forwardFromClient(client.id, { type: 'steer', id: 'c1', session_id: 's1', text: 'go' })
    const fwd = agent.sent[0]
    expect(fwd).toMatchObject({ type: 'steer', text: 'go' })
    expect(fwd.session_id).toBeUndefined()
    expect(fwd.id).not.toBe('c1') // broker-unique

    // agent replies on the broker id → client gets its original id back
    broker.routeFromAgent('s1', { type: 'response', command: 'steer', id: fwd.id, success: true })
    expect(client.socket.sent.at(-1)).toMatchObject({
      type: 'response',
      id: 'c1',
      session_id: 's1',
      success: true,
    })
  })

  it('preserves a numeric client-local id across the round-trip', () => {
    const broker = new Broker()
    const agent = mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    const client = mkClient(broker, 'u1')
    broker.forwardFromClient(client.id, { type: 'steer', id: 42, session_id: 's1' })
    const fwd = agent.sent[0]
    broker.routeFromAgent('s1', { type: 'response', command: 'steer', id: fwd.id, success: true })
    expect(client.socket.sent.at(-1)).toMatchObject({ type: 'response', id: 42 })
  })

  it('blocks cross-user routing', () => {
    const broker = new Broker()
    const agent = mkAgent(broker, { sessionId: 's1', userId: 'u2' })
    const client = mkClient(broker, 'u1')
    broker.forwardFromClient(client.id, { type: 'steer', id: 'c1', session_id: 's1' })
    expect(client.socket.sent.at(-1)).toMatchObject({ type: 'error', code: 'not_found' })
    expect(agent.sent).toHaveLength(0)
  })

  it('keeps two tabs’ identical client-local ids from colliding', () => {
    const broker = new Broker()
    const agent = mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    const a = mkClient(broker, 'u1')
    const b = mkClient(broker, 'u1')

    broker.forwardFromClient(a.id, { type: 'steer', id: 'c1', session_id: 's1' })
    broker.forwardFromClient(b.id, { type: 'steer', id: 'c1', session_id: 's1' })
    const [fwdA, fwdB] = agent.sent
    expect(fwdA.id).not.toBe(fwdB.id) // distinct broker ids

    broker.routeFromAgent('s1', { type: 'response', command: 'steer', id: fwdB.id, success: true })
    broker.routeFromAgent('s1', { type: 'response', command: 'steer', id: fwdA.id, success: true })
    // each response went only to the tab that issued it, with its own id 'c1'
    expect(a.socket.sent.at(-1)).toMatchObject({ type: 'response', id: 'c1' })
    expect(b.socket.sent.at(-1)).toMatchObject({ type: 'response', id: 'c1' })
    expect(a.socket.sent.filter((m) => m.type === 'response')).toHaveLength(1)
    expect(b.socket.sent.filter((m) => m.type === 'response')).toHaveLength(1)
  })

  it('fans events out to all of the user’s clients', () => {
    const broker = new Broker()
    mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    const a = mkClient(broker, 'u1')
    const b = mkClient(broker, 'u1')
    const other = mkClient(broker, 'u2')

    broker.routeFromAgent('s1', { type: 'tool_update', seq: 5, status: 'running' })
    const evt = { type: 'tool_update', seq: 5, status: 'running', session_id: 's1' }
    expect(a.socket.sent.at(-1)).toEqual(evt)
    expect(b.socket.sent.at(-1)).toEqual(evt)
    expect(other.socket.sent.some((m) => m.type === 'tool_update')).toBe(false)
  })

  it('stops delivering to an unregistered client', () => {
    const broker = new Broker()
    mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    const a = mkClient(broker, 'u1')
    broker.unregisterClient(a.id)
    const before = a.socket.sent.length
    broker.routeFromAgent('s1', { type: 'tool_update', seq: 1 })
    expect(a.socket.sent.length).toBe(before)
  })
})

describe('Broker — start_session (§5.4)', () => {
  it('selects an idle agent and forwards the prompt', () => {
    const broker = new Broker()
    const agent = mkAgent(broker, { sessionId: 's1', userId: 'u1', state: 'idle' })
    const client = mkClient(broker, 'u1')
    broker.forwardFromClient(client.id, {
      type: 'start_session',
      id: 'c1',
      repo: 'acme/web',
      prompt: 'fix the build',
    })
    expect(client.socket.sent.at(-1)).toMatchObject({
      type: 'response',
      command: 'start_session',
      id: 'c1',
      success: true,
      data: { session_id: 's1' },
    })
    expect(agent.sent.at(-1)).toMatchObject({ type: 'prompt', message: 'fix the build' })
  })

  it('reserves the chosen agent (busy) so a second start_session sees none', () => {
    const broker = new Broker()
    mkAgent(broker, { sessionId: 's1', userId: 'u1', state: 'idle' })
    const a = mkClient(broker, 'u1')
    const b = mkClient(broker, 'u1')
    broker.forwardFromClient(a.id, { type: 'start_session', id: 'c1', repo: 'acme/web', prompt: 'go' })
    broker.forwardFromClient(b.id, { type: 'start_session', id: 'c2', repo: 'acme/web', prompt: 'go' })
    expect(a.socket.sent.at(-1)).toMatchObject({ success: true })
    expect(b.socket.sent.at(-1)).toMatchObject({ success: false, error: 'no_available_agent' })
  })

  it('replies no_available_agent when none are idle/accepting', () => {
    const broker = new Broker()
    mkAgent(broker, { sessionId: 's1', userId: 'u1', state: 'busy' }) // busy
    mkAgent(broker, { sessionId: 's2', userId: 'u1', availability: { acceptTask: false } })
    const client = mkClient(broker, 'u1')
    broker.forwardFromClient(client.id, { type: 'start_session', id: 'c1', repo: 'acme/web' })
    expect(client.socket.sent.at(-1)).toMatchObject({
      command: 'start_session',
      success: false,
      error: 'no_available_agent',
    })
  })

  it('selectIdleAgent honours repo + busy state', () => {
    const broker = new Broker()
    mkAgent(broker, { sessionId: 's1', userId: 'u1', availability: { acceptTask: true, repo: 'a' } })
    mkAgent(broker, { sessionId: 's2', userId: 'u1', availability: { acceptTask: true, repo: 'b' } })
    expect(broker.selectIdleAgent('u1', 'b')?.sessionId).toBe('s2')
    expect(broker.selectIdleAgent('u1', 'zzz')).toBeUndefined()
  })
})

describe('Broker — defensive no-ops', () => {
  it('ignores a response with no pending correlation', () => {
    const broker = new Broker()
    mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    expect(() =>
      broker.routeFromAgent('s1', { type: 'response', id: 'unknown', success: true }),
    ).not.toThrow()
  })

  it('ignores frames from an unknown session and forwards from an unknown client', () => {
    const broker = new Broker()
    expect(() => broker.routeFromAgent('ghost', { type: 'tool_update' })).not.toThrow()
    expect(() => broker.forwardFromClient('ghost', { type: 'steer' })).not.toThrow()
  })
})

describe('client handler (ws/client.ts)', () => {
  it('snapshots on connect, forwards valid frames, and closes on a bad frame', () => {
    const broker = new Broker()
    const agent = mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    const cs = new FakeSocket()
    handleClientConnection(broker, cs, { userId: 'u1' })

    expect(cs.frames()[0]).toMatchObject({ type: 'sessions' })
    cs.deliver({ type: 'steer', id: 'c1', session_id: 's1', text: 'go' })
    expect(agent.sent.at(-1)).toMatchObject({ type: 'steer', text: 'go' })

    cs.deliver('binary', true)
    expect(cs.lastClose).toBe(CLOSE_CODES.PROTOCOL_ERROR)
  })

  it('closes with 1011 if forwarding throws synchronously', () => {
    const broker = new Broker()
    broker.forwardFromClient = () => {
      throw new Error('boom')
    }
    const cs = new FakeSocket()
    handleClientConnection(broker, cs, { userId: 'u1' })
    cs.deliver({ type: 'steer', id: 'c1', session_id: 's1' })
    expect(cs.lastClose).toBe(CLOSE_CODES.INTERNAL)
  })

  it('rejects a client over the per-user cap with 1013', () => {
    const broker = new Broker()
    broker.registerClient({ clientId: 'pre', userId: 'u1', socket: sock() })
    const cs = new FakeSocket()
    const id = handleClientConnection(broker, cs, { userId: 'u1' }, { maxClientsPerUser: 1 })
    expect(id).toBeUndefined()
    expect(cs.lastClose).toBe(CLOSE_CODES.TRY_LATER)
  })

  it('closes with 1008 when the client frame rate is exceeded', () => {
    const broker = new Broker()
    mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    const cs = new FakeSocket()
    handleClientConnection(broker, cs, { userId: 'u1' }, { rateMax: 1, rateWindowMs: 10_000 })
    cs.deliver({ type: 'steer', id: 'c1', session_id: 's1' }) // allowed
    cs.deliver({ type: 'steer', id: 'c2', session_id: 's1' }) // over cap
    expect(cs.lastClose).toBe(CLOSE_CODES.POLICY_VIOLATION)
  })

  it('unregisters the client on close (no further delivery)', () => {
    const broker = new Broker()
    mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    const cs = new FakeSocket()
    handleClientConnection(broker, cs, { userId: 'u1' })
    cs.close(1000) // fires the close handler → unregister
    const before = cs.frames().length
    broker.routeFromAgent('s1', { type: 'tool_update' })
    expect(cs.frames().length).toBe(before) // unregistered → received nothing new
  })
})

describe('Broker — stats & shutdown', () => {
  it('reports live + cumulative stats', () => {
    const broker = new Broker()
    mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    mkClient(broker, 'u1')
    broker.unregisterAgent('s1')
    const stats = broker.stats()
    expect(stats.agents_live).toBe(0)
    expect(stats.clients_live).toBe(1)
    expect(stats.agent_connections_total).toBe(1)
    expect(stats.client_connections_total).toBe(1)
  })

  it('lists a user’s clients', () => {
    const broker = new Broker()
    mkClient(broker, 'u1')
    mkClient(broker, 'u1')
    mkClient(broker, 'u2')
    expect(broker.listClientsByUser('u1')).toHaveLength(2)
  })

  it('closeAll advises reconnect and closes every socket (going-away)', () => {
    const broker = new Broker()
    const agent = mkAgent(broker, { sessionId: 's1', userId: 'u1' })
    const client = mkClient(broker, 'u1')
    broker.closeAll(1001)
    expect(agent.closes).toEqual([1001])
    expect(client.socket.closes).toEqual([1001])
    expect(agent.sent.at(-1)).toMatchObject({ type: 'reconnect_hint' })
    expect(client.socket.sent.at(-1)).toMatchObject({ type: 'reconnect_hint' })
  })

  it('closeAll keeps draining when a socket throws', () => {
    const broker = new Broker()
    const closed: string[] = []
    const bad = {
      send: () => {
        throw new Error('broken')
      },
      close: () => {
        throw new Error('broken')
      },
    }
    const good = { send: () => {}, close: () => closed.push('good') }
    broker.registerAgent({ sessionId: 's1', userId: 'u1', jti: 'j', familyId: 'f', socket: bad, availability: { acceptTask: false }, state: 'idle' })
    broker.registerAgent({ sessionId: 's2', userId: 'u1', jti: 'j2', familyId: 'f2', socket: good, availability: { acceptTask: false }, state: 'idle' })
    expect(() => broker.closeAll(1001)).not.toThrow()
    expect(closed).toEqual(['good']) // the good socket still got closed
  })

  it('counts routing errors', () => {
    const broker = new Broker()
    const client = mkClient(broker, 'u1')
    broker.forwardFromClient(client.id, { type: 'steer', id: 'c1', session_id: 'ghost' })
    expect(broker.stats().routing_errors_total).toBe(1)
  })
})

describe('Broker — revocation', () => {
  it('closes every socket in a family and counts them', () => {
    const broker = new Broker()
    const a = mkAgent(broker, { sessionId: 's1', userId: 'u1', familyId: 'fam_x' })
    const b = mkAgent(broker, { sessionId: 's2', userId: 'u1', familyId: 'fam_x' })
    const c = mkAgent(broker, { sessionId: 's3', userId: 'u1', familyId: 'fam_y' })
    expect(broker.closeFamily('fam_x', 4403)).toBe(2)
    expect(a.closes).toEqual([4403])
    expect(b.closes).toEqual([4403])
    expect(c.closes).toEqual([])
  })
})
