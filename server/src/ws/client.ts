import { newId } from '../auth/tokens.ts'
import type { Broker, ClosableSocket } from '../broker/registry.ts'
import { parseFrame } from './framing.ts'

/** The socket surface the client handler drives (satisfied by `ws.WebSocket`). */
export interface ClientSocket extends ClosableSocket {
  on(event: 'message', cb: (data: string, isBinary: boolean) => void): void
  on(event: 'close', cb: () => void): void
}

/**
 * Drive one `/client` (browser) connection (spec §5). The socket is already
 * ticket-authenticated at the upgrade, so we know `userId`: register it (which
 * sends the `sessions` snapshot), then forward each multiplexed envelope to the
 * broker for ownership-checked routing.
 */
export function handleClientConnection(
  broker: Broker,
  socket: ClientSocket,
  ctx: { userId: string },
): string {
  const clientId = newId('cli')
  broker.registerClient({ clientId, userId: ctx.userId, socket })

  socket.on('message', (data, isBinary) => {
    const res = parseFrame(typeof data === 'string' ? data : String(data), isBinary)
    if (!res.ok) {
      socket.close(res.code)
      return
    }
    broker.forwardFromClient(clientId, res.frame)
  })

  socket.on('close', () => broker.unregisterClient(clientId))
  return clientId
}
