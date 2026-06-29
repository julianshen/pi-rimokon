import { CLOSE_CODES } from '../../../shared/protocol.ts'
import type { AuthContext } from '../auth/context.ts'
import { newId, verifyAgentToken } from '../auth/tokens.ts'
import type { ClosableSocket, SessionHub } from '../broker/registry.ts'
import { agentSessions, agentTokens } from '../db/repositories.ts'
import { parseFrame } from './framing.ts'
import { type AgentAvailability, validateHello } from './handshake.ts'

const SERVER_NAME = 'pi-remote/0.1.0'

/** The socket surface the agent handler drives (satisfied by `ws.WebSocket`). */
export interface AgentSocket extends ClosableSocket {
  ping(): void
  on(event: 'message', cb: (data: string, isBinary: boolean) => void): void
  on(event: 'pong', cb: () => void): void
  on(event: 'close', cb: () => void): void
}

export interface AgentConnOptions {
  /** Bearer token from the upgrade `Authorization` header (preferred). */
  headerToken?: string
  handshakeMs?: number
  heartbeatMs?: number
}

/**
 * Drive one `/agent` connection through its lifecycle (spec §4): a bounded
 * handshake window, `hello`/`resume` auth + negotiation, framing guards,
 * ping/pong heartbeat, session-row lifecycle, and registration in the hub for
 * routing (M3) + revocation tear-down. v1 resume just rebinds (no replay, §9).
 */
export function handleAgentConnection(
  ctx: AuthContext,
  hub: SessionHub,
  socket: AgentSocket,
  opts: AgentConnOptions = {},
): void {
  const handshakeMs = opts.handshakeMs ?? 5000
  const heartbeatMs = opts.heartbeatMs ?? 30000

  let authed = false
  let sessionId: string | undefined
  let lastSeq = 0
  let lastPong = Date.now()
  let heartbeat: ReturnType<typeof setInterval> | undefined

  // A socket may open before it has authenticated (header- or hello-token);
  // close it if a valid handshake doesn't complete in time (spec §4.1 → 4408).
  const handshakeTimer = setTimeout(() => {
    if (!authed) socket.close(CLOSE_CODES.TIMEOUT)
  }, handshakeMs)

  function cleanup(): void {
    clearTimeout(handshakeTimer)
    if (heartbeat) clearInterval(heartbeat)
    if (sessionId) {
      hub.unregister(sessionId)
      void agentSessions.end(ctx.db, sessionId, lastSeq, new Date(ctx.now() * 1000)).catch(() => {})
    }
  }

  socket.on('close', cleanup)
  socket.on('pong', () => {
    lastPong = Date.now()
  })

  socket.on('message', (data, isBinary) => {
    const res = parseFrame(typeof data === 'string' ? data : String(data), isBinary)
    if (!res.ok) {
      socket.close(res.code)
      return
    }
    if (authed) {
      // M2 has no broker yet: just track the per-session event high-water mark.
      const seq = res.frame.seq
      if (typeof seq === 'number' && seq > lastSeq) lastSeq = seq
      return
    }
    void completeHandshake(res.frame)
  })

  async function completeHandshake(frame: Record<string, unknown>): Promise<void> {
    const type = frame.type
    if (type !== 'hello' && type !== 'resume') {
      socket.close(CLOSE_CODES.PROTOCOL_ERROR)
      return
    }

    let availability: AgentAvailability = { acceptTask: false }
    if (type === 'hello') {
      const hello = validateHello(frame)
      if (!hello.ok) {
        if (hello.reason === 'bad_protocol') {
          socket.send(
            JSON.stringify({
              type: 'response',
              command: 'hello',
              id: frame.id,
              success: false,
              error: 'unsupported protocol version',
            }),
          )
        }
        socket.close(CLOSE_CODES.PROTOCOL_ERROR)
        return
      }
      availability = hello.availability
    }

    const token = opts.headerToken ?? (typeof frame.token === 'string' ? frame.token : undefined)
    if (!token) {
      socket.close(CLOSE_CODES.UNAUTHORIZED)
      return
    }
    let payload
    try {
      payload = await verifyAgentToken(ctx.keys, token, { issuer: ctx.issuer })
    } catch {
      socket.close(CLOSE_CODES.UNAUTHORIZED)
      return
    }
    const jti = String(payload.jti)
    const userId = String(payload.sub)
    const familyId = String(payload.family_id)
    if (!(await agentTokens.isActive(ctx.db, jti))) {
      socket.close(CLOSE_CODES.FORBIDDEN) // revoked → 4403
      return
    }

    sessionId = newId('ses')
    await agentSessions.start(ctx.db, { sessionId, userId, jti, repo: availability.repo })
    authed = true
    clearTimeout(handshakeTimer)
    hub.register({ sessionId, userId, jti, familyId, socket, availability })

    socket.send(
      JSON.stringify({
        type: 'response',
        command: type,
        id: frame.id,
        success: true,
        data: {
          session_id: sessionId,
          user_id: userId,
          server: SERVER_NAME,
          heartbeat_sec: Math.round(heartbeatMs / 1000),
        },
      }),
    )
    socket.send(JSON.stringify({ type: 'ready', session_id: sessionId }))

    lastPong = Date.now()
    heartbeat = setInterval(() => {
      if (Date.now() - lastPong > heartbeatMs * 2) {
        socket.close(CLOSE_CODES.TIMEOUT) // missed pongs → 4408
        return
      }
      socket.ping()
    }, heartbeatMs)
  }
}
