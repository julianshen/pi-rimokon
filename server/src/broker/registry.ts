import { newId } from '../auth/tokens.ts'
import type { AgentAvailability } from '../ws/handshake.ts'

/** The minimal socket surface the broker needs to address a connection. */
export interface ClosableSocket {
  close(code: number, reason?: string): void
  send(data: string): void
}

export interface AgentSession {
  sessionId: string
  userId: string
  jti: string
  familyId: string
  socket: ClosableSocket
  availability: AgentAvailability
  /** Live idle/busy state (seeds from the hello, updated via `agent_state`). */
  state: string
}

export interface WebClientConn {
  clientId: string
  userId: string
  socket: ClosableSocket
}

interface Pending {
  clientId: string
  originalId?: string
}

/**
 * The per-user broker (spec §5.3): a single-instance, in-memory registry of
 * live agent sessions + web clients, plus the routing that connects them.
 * Cross-user routing is impossible by construction — every forward checks that
 * the target session's `userId` matches the requesting client's. v2 swaps the
 * maps for a shared bus.
 */
export class Broker {
  private readonly agents = new Map<string, AgentSession>()
  private readonly clients = new Map<string, WebClientConn>()
  /** broker-unique command id → originating client + its client-local id. */
  private readonly pending = new Map<string, Pending>()

  // --- agent side (driven by the /agent handler + revocation) -------------

  registerAgent(session: AgentSession): void {
    this.agents.set(session.sessionId, session)
    this.toUserClients(session.userId, { type: 'session_online', ...this.descriptor(session) })
  }

  unregisterAgent(sessionId: string): void {
    const session = this.agents.get(sessionId)
    if (!session) return
    this.agents.delete(sessionId)
    this.toUserClients(session.userId, {
      type: 'session_offline',
      session_id: sessionId,
      reason: 'closed',
    })
  }

  getAgent(sessionId: string): AgentSession | undefined {
    return this.agents.get(sessionId)
  }

  listAgentsByUser(userId: string): AgentSession[] {
    return [...this.agents.values()].filter((a) => a.userId === userId)
  }

  /** Update + broadcast an agent's idle/busy state (spec §5 `agent_state`). */
  setAgentState(sessionId: string, state: string): void {
    const session = this.agents.get(sessionId)
    if (!session) return
    session.state = state
    this.toUserClients(session.userId, { type: 'agent_state', session_id: sessionId, state })
  }

  /** Close every live socket in a revoked token family (spec §3.2 → 4403). */
  closeFamily(familyId: string, code: number): number {
    const targets = [...this.agents.values()].filter((s) => s.familyId === familyId)
    for (const session of targets) session.socket.close(code)
    return targets.length
  }

  /** Route a frame coming FROM an agent back to the right web client(s). */
  routeFromAgent(sessionId: string, frame: Record<string, unknown>): void {
    const agent = this.agents.get(sessionId)
    if (!agent) return
    if (frame.type === 'response') {
      // Correlate by the broker-unique id, restore the client-local id, and
      // deliver to the exact client that issued the command (spec §5.3).
      const p = this.pending.get(String(frame.id ?? ''))
      if (!p) return
      this.pending.delete(String(frame.id))
      this.clients
        .get(p.clientId)
        ?.socket.send(JSON.stringify({ ...frame, id: p.originalId, session_id: sessionId }))
      return
    }
    // Event → fan out (with session_id + the handler-stamped seq) to the user's
    // clients watching this session (v1: all of the user's clients).
    this.toUserClients(agent.userId, { ...frame, session_id: sessionId })
  }

  // --- client side (driven by the /client handler) ------------------------

  registerClient(client: WebClientConn): void {
    this.clients.set(client.clientId, client)
    client.socket.send(JSON.stringify(this.snapshot(client.userId)))
  }

  unregisterClient(clientId: string): void {
    this.clients.delete(clientId)
    for (const [id, p] of this.pending) if (p.clientId === clientId) this.pending.delete(id)
  }

  /** The `sessions` snapshot a client gets on connect (spec §5.2). */
  snapshot(userId: string): Record<string, unknown> {
    return { type: 'sessions', sessions: this.listAgentsByUser(userId).map((a) => this.descriptor(a)) }
  }

  /** Route a multiplexed envelope coming FROM a web client (spec §5.2/§5.3). */
  forwardFromClient(clientId: string, envelope: Record<string, unknown>): void {
    const client = this.clients.get(clientId)
    if (!client) return
    if (envelope.type === 'start_session') {
      this.startSession(client, envelope)
      return
    }
    const sessionId = typeof envelope.session_id === 'string' ? envelope.session_id : undefined
    const agent = sessionId ? this.agents.get(sessionId) : undefined
    // Ownership check: the target must be one of the requester's own sessions.
    if (!agent || agent.userId !== client.userId) {
      client.socket.send(
        JSON.stringify({
          type: 'error',
          code: 'not_found',
          message: 'unknown or unauthorized session',
          id: envelope.id,
          session_id: sessionId,
        }),
      )
      return
    }
    this.deliverToAgent(client, agent, envelope)
  }

  /** Select an idle, task-accepting agent for the user (spec §5.4). */
  selectIdleAgent(userId: string, repo?: string): AgentSession | undefined {
    return this.listAgentsByUser(userId).find(
      (a) => a.availability.acceptTask && a.state !== 'busy' && (!repo || a.availability.repo === repo),
    )
  }

  private startSession(client: WebClientConn, envelope: Record<string, unknown>): void {
    const repo = typeof envelope.repo === 'string' ? envelope.repo : undefined
    const agent = this.selectIdleAgent(client.userId, repo)
    if (!agent) {
      client.socket.send(
        JSON.stringify({
          type: 'response',
          command: 'start_session',
          id: envelope.id,
          success: false,
          error: 'no_available_agent',
        }),
      )
      return
    }
    client.socket.send(
      JSON.stringify({
        type: 'response',
        command: 'start_session',
        id: envelope.id,
        success: true,
        data: { session_id: agent.sessionId },
      }),
    )
    // Hand the prompt to the chosen agent as a normal command (spec §5.4).
    if (typeof envelope.prompt === 'string') {
      const brokerId = newId('brk')
      this.pending.set(brokerId, { clientId: client.clientId })
      agent.socket.send(JSON.stringify({ type: 'prompt', id: brokerId, text: envelope.prompt }))
    }
  }

  private deliverToAgent(
    client: WebClientConn,
    agent: AgentSession,
    envelope: Record<string, unknown>,
  ): void {
    // Rewrite the client-local id to a broker-unique one so two tabs reusing
    // the same id can't collide on correlation (spec §5.3); restored on reply.
    const brokerId = newId('brk')
    this.pending.set(brokerId, {
      clientId: client.clientId,
      originalId: typeof envelope.id === 'string' ? envelope.id : undefined,
    })
    // Strip the routing envelope (session_id) and rewrite id → broker-unique.
    const { session_id: _session, id: _id, ...rest } = envelope
    void _session
    void _id
    agent.socket.send(JSON.stringify({ ...rest, id: brokerId }))
  }

  private descriptor(a: AgentSession): Record<string, unknown> {
    return {
      session_id: a.sessionId,
      repo: a.availability.repo ?? null,
      status: 'online',
      state: a.state,
      accept_task: a.availability.acceptTask,
    }
  }

  private toUserClients(userId: string, msg: Record<string, unknown>): void {
    const payload = JSON.stringify(msg)
    for (const client of this.clients.values()) {
      if (client.userId === userId) client.socket.send(payload)
    }
  }
}
