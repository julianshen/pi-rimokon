import { CLOSE_CODES } from '../../../shared/protocol.ts'
import { newId } from '../auth/tokens.ts'
import type { Broker, ClosableSocket } from '../broker/registry.ts'
import { parseFrame } from './framing.ts'
import { createRateLimiter } from './rateLimiter.ts'

/** The socket surface the client handler drives (satisfied by `ws.WebSocket`). */
export interface ClientSocket extends ClosableSocket {
  on(event: 'message', cb: (data: string, isBinary: boolean) => void): void
  on(event: 'close', cb: () => void): void
}

export interface ClientConnOptions {
  /** Max concurrent clients per user (spec §7); 0/undefined = unlimited. */
  maxClientsPerUser?: number
  rateMax?: number
  rateWindowMs?: number
}

/**
 * Drive one `/client` (browser) connection (spec §5). The socket is already
 * ticket-authenticated at the upgrade, so we know `userId`: enforce the
 * per-user client cap, register it (which sends the `sessions` snapshot), then
 * forward each rate-limited multiplexed envelope to the broker.
 */
export function handleClientConnection(
  broker: Broker,
  socket: ClientSocket,
  ctx: { userId: string },
  opts: ClientConnOptions = {},
): string | undefined {
  const cap = opts.maxClientsPerUser ?? 0
  if (cap > 0 && broker.listClientsByUser(ctx.userId).length >= cap) {
    socket.send(JSON.stringify({ type: 'error', code: 'too_many_clients' }))
    socket.close(CLOSE_CODES.TRY_LATER) // 1013
    return undefined
  }

  const clientId = newId('cli')
  const limiter = createRateLimiter(opts.rateMax ?? 120, opts.rateWindowMs ?? 1000)
  broker.registerClient({ clientId, userId: ctx.userId, socket })

  socket.on('message', (data, isBinary) => {
    if (!limiter.allow()) {
      socket.close(CLOSE_CODES.POLICY_VIOLATION) // 1008
      return
    }
    const res = parseFrame(typeof data === 'string' ? data : String(data), isBinary)
    if (!res.ok) {
      socket.close(res.code)
      return
    }
    try {
      broker.forwardFromClient(clientId, res.frame)
    } catch {
      socket.close(CLOSE_CODES.INTERNAL) // a synchronous routing/send failure → 1011
    }
  })

  socket.on('close', () => broker.unregisterClient(clientId))
  return clientId
}
