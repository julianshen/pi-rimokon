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
}

/**
 * In-memory registry of live agent sessions, keyed for the two lookups the
 * server needs: by session id (routing, M3) and by token family (revocation
 * tear-down, spec §3.2). A single-instance v1 structure; M3/v2 swaps it for a
 * shared bus.
 */
export class SessionHub {
  private readonly byId = new Map<string, AgentSession>()

  register(session: AgentSession): void {
    this.byId.set(session.sessionId, session)
  }

  unregister(sessionId: string): void {
    this.byId.delete(sessionId)
  }

  get(sessionId: string): AgentSession | undefined {
    return this.byId.get(sessionId)
  }

  /** All live sessions owned by a user (spec §5.3 ownership / §5.4 selection). */
  listByUser(userId: string): AgentSession[] {
    return [...this.byId.values()].filter((s) => s.userId === userId)
  }

  /** Close every live socket in a revoked token family (spec §3.2 → 4403). */
  closeFamily(familyId: string, code: number): number {
    let closed = 0
    for (const session of this.byId.values()) {
      if (session.familyId === familyId) {
        session.socket.close(code)
        closed += 1
      }
    }
    return closed
  }
}
