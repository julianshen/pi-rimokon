import type { Server } from 'node:http'
import { type RawData, type WebSocket, WebSocketServer } from 'ws'
import { WS_SUBPROTOCOL } from '../../../shared/protocol.ts'
import type { AuthContext } from '../auth/context.ts'
import type { SessionHub } from '../broker/registry.ts'
import { type AgentConnOptions, type AgentSocket, handleAgentConnection } from './agent.ts'

function bearerFromHeader(header?: string): string | undefined {
  return /^Bearer\s+(.+)$/i.exec((header ?? '').trim())?.[1]?.trim()
}

/** Adapt a `ws.WebSocket` to the minimal {@link AgentSocket} the handler uses. */
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

/**
 * Route the HTTP `upgrade` event for `/agent` to a WebSocket connection
 * (spec §4.1). Other paths are destroyed (the `/client` socket lands in M3).
 */
export function attachAgentServer(
  server: Server,
  ctx: AuthContext,
  hub: SessionHub,
  opts: AgentConnOptions = {},
): WebSocketServer {
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => (protocols.has(WS_SUBPROTOCOL) ? WS_SUBPROTOCOL : false),
  })

  server.on('upgrade', (req, socket, head) => {
    let pathname: string
    try {
      pathname = new URL(req.url ?? '', 'http://localhost').pathname
    } catch {
      socket.destroy()
      return
    }
    // Only claim `/agent`; leave other paths for sibling upgrade listeners
    // (the `/client` broker lands in M3, which also owns the unmatched-path
    // fallback so we don't destroy a socket another listener wants).
    if (pathname !== '/agent') return
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleAgentConnection(ctx, hub, wrap(ws), {
        headerToken: bearerFromHeader(req.headers.authorization),
        ...opts,
      })
    })
  })

  return wss
}
