import { CLOSE_CODES } from '../../../shared/protocol.ts'
import type { AuthContext } from '../auth/context.ts'
import { newId, verifyAgentToken } from '../auth/tokens.ts'
import type { Broker, ClosableSocket } from '../broker/registry.ts'
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
  broker: Broker,
  socket: AgentSocket,
  opts: AgentConnOptions = {},
): void {
  const handshakeMs = opts.handshakeMs ?? 5000
  const heartbeatMs = opts.heartbeatMs ?? 30000

  let authed = false
  let handshaking = false
  let closed = false
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
    closed = true
    clearTimeout(handshakeTimer)
    if (heartbeat) clearInterval(heartbeat)
    if (sessionId) {
      broker.unregisterAgent(sessionId)
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
      const frame = res.frame
      if (frame.type === 'response') {
        // Correlated by id — hand to the broker to route back to the client.
        broker.routeFromAgent(sessionId as string, frame)
        return
      }
      // The base Pi RPC protocol carries no seq; the server stamps a
      // per-session monotonic seq on each inbound event before fan-out.
      lastSeq += 1
      frame.seq = lastSeq
      if (frame.type === 'state' && typeof frame.state === 'string') {
        broker.setAgentState(sessionId as string, frame.state)
      }
      broker.routeFromAgent(sessionId as string, frame)
      return
    }
    // Only one handshake runs per connection; frames arriving while it is
    // in-flight are dropped (a well-behaved agent waits for `ready`).
    if (handshaking) return
    handshaking = true
    void completeHandshake(res.frame)
  })

  async function completeHandshake(frame: Record<string, unknown>): Promise<void> {
    try {
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
      // The socket may have closed during the awaits above — before this point
      // the `close` handler had no sessionId to clean up, so end the row and
      // bail rather than registering a dead socket / leaking a heartbeat.
      if (closed) {
        await agentSessions.end(ctx.db, sessionId, lastSeq, new Date(ctx.now() * 1000))
        return
      }
      authed = true
      clearTimeout(handshakeTimer)
      broker.registerAgent({
        sessionId,
        userId,
        jti,
        familyId,
        socket,
        availability,
        state: availability.state ?? 'idle',
      })

      // Re-check after registering: if the family was revoked during the
      // handshake's await window, closeFamily ran before this socket was in the
      // hub and would have missed it. This closes that race (spec §3.2 → 4403).
      if (!(await agentTokens.isActive(ctx.db, jti))) {
        socket.close(CLOSE_CODES.FORBIDDEN)
        return
      }
      if (closed) return // closed during the re-check await; cleanup already ran

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
    } catch {
      // Unexpected (e.g. DB) failure during the handshake — don't leak an
      // unhandled rejection; tear the socket down with 1011.
      socket.close(CLOSE_CODES.INTERNAL)
    } finally {
      handshaking = false
    }
  }
}
