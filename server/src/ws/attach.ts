import type { Server } from 'node:http'
import { type RawData, type WebSocket, WebSocketServer } from 'ws'
import { WS_SUBPROTOCOL } from '../../../shared/protocol.ts'
import type { AuthContext } from '../auth/context.ts'
import type { Broker } from '../broker/registry.ts'
import type { TicketStore } from '../broker/tickets.ts'
import { type AgentConnOptions, type AgentSocket, handleAgentConnection } from './agent.ts'
import { type ClientConnOptions, handleClientConnection } from './client.ts'

function bearerFromHeader(header?: string): string | undefined {
  return /^Bearer\s+(.+)$/i.exec((header ?? '').trim())?.[1]?.trim()
}

/**
 * Adapt a `ws.WebSocket` to {@link AgentSocket} (the superset of what both
 * handlers need; the client handler simply ignores `ping`/`pong`).
 */
function wrap(ws: WebSocket): AgentSocket {
  return {
    send: (data: string) => ws.send(data),
    close: (code: number, reason?: string) => ws.close(code, reason),
    ping: () => ws.ping(),
    on: ((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'message') {
        ws.on('message', (data: RawData, isBinary: boolean) =>
          cb(isBinary ? data : data.toString(), isBinary),
        )
      } else {
        ws.on(event as 'pong' | 'close', () => cb())
      }
    }) as AgentSocket['on'],
  }
}

interface AttachOptions extends AgentConnOptions, ClientConnOptions {
  ticketStore: TicketStore
}

/**
 * Route the HTTP `upgrade` event to the right WebSocket handler by path
 * (spec §4.1 / §5.1): `/agent` (Bearer on the header) and `/client` (a
 * single-use ticket on the query string, plus an Origin allow-list).
 */
export function attachWebSockets(
  server: Server,
  ctx: AuthContext,
  broker: Broker,
  opts: AttachOptions,
): WebSocketServer {
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => (protocols.has(WS_SUBPROTOCOL) ? WS_SUBPROTOCOL : false),
  })

  server.on('upgrade', (req, socket, head) => {
    let url: URL
    try {
      url = new URL(req.url ?? '', 'http://localhost')
    } catch {
      socket.destroy()
      return
    }

    if (url.pathname === '/agent') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        handleAgentConnection(ctx, broker, wrap(ws), {
          headerToken: bearerFromHeader(req.headers.authorization),
          handshakeMs: opts.handshakeMs,
          heartbeatMs: opts.heartbeatMs,
          maxSessionsPerUser: opts.maxSessionsPerUser,
          rateMax: opts.rateMax,
          rateWindowMs: opts.rateWindowMs,
        })
      })
      return
    }

    if (url.pathname === '/client') {
      // Browser origin allow-list (spec §7); '*' disables the check. A missing
      // Origin is rejected too, so a non-browser client can't bypass the gate.
      if (
        ctx.allowedOrigin &&
        ctx.allowedOrigin !== '*' &&
        req.headers.origin !== ctx.allowedOrigin
      ) {
        socket.destroy()
        return
      }
      const userId = opts.ticketStore.redeem(url.searchParams.get('ticket') ?? '')
      if (!userId) {
        socket.destroy() // unknown/expired/used ticket → reject the upgrade
        return
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        handleClientConnection(broker, wrap(ws), { userId }, {
          maxClientsPerUser: opts.maxClientsPerUser,
          rateMax: opts.rateMax,
          rateWindowMs: opts.rateWindowMs,
        })
      })
      return
    }

    socket.destroy()
  })

  return wss
}
