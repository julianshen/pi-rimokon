import WebSocketImpl from 'ws'
import { type CommandFrame, PROTOCOL_VERSION, WS_SUBPROTOCOL } from './protocol.ts'

/** What the agent advertises about this session (spec §4.1 / §5.4). */
export interface Availability {
  mode?: string
  state: 'idle' | 'busy'
  cwd?: string
  repo?: string
  acceptTask: boolean
}

/** Minimal socket surface (the `ws` WebSocket satisfies it). */
export interface RawSocket {
  send(data: string): void
  close(code?: number): void
  on(event: 'open' | 'message' | 'close' | 'error', cb: (arg?: unknown) => void): void
}

export type SocketFactory = (url: string, protocol: string, headers: Record<string, string>) => RawSocket

export type ConnStatus =
  | { state: 'connecting' }
  | { state: 'ready'; sessionId: string }
  | { state: 'reconnecting'; code?: number }
  | { state: 'stopped' }

export interface ConnectionOptions {
  /** Server origin, e.g. wss://agents.jlnshen.com (the /agent path is appended). */
  wsUrl: string
  getToken: () => Promise<string>
  availability: () => Availability
  /** Handle an inbound command; call `reply` with the response payload. */
  onCommand: (frame: CommandFrame, reply: (payload: Record<string, unknown>) => void) => void
  onStatus?: (s: ConnStatus) => void
  socketFactory?: SocketFactory
  reconnectMs?: number
}

/* v8 ignore start -- real `ws` glue; exercised via the live server, not unit tests */
const defaultFactory: SocketFactory = (url, protocol, headers) => {
  const ws = new WebSocketImpl(url, protocol, { headers })
  return {
    send: (d) => ws.send(d),
    close: (c) => ws.close(c),
    on: (event, cb) => {
      if (event === 'message') ws.on('message', (data: WebSocketImpl.RawData) => cb(data.toString()))
      else if (event === 'close') ws.on('close', (code: number) => cb(code))
      else ws.on(event, () => cb())
    },
  }
}
/* v8 ignore stop */

/**
 * Bridges the live Pi session to the Pi Remote Server `/agent` socket: device-
 * token auth, the hello/ready handshake, inbound command dispatch, outbound
 * event emit (the server stamps seq), and reconnect-with-rebind (v1, no replay).
 */
export class RemoteConnection {
  private readonly opts: ConnectionOptions
  private readonly factory: SocketFactory
  private readonly reconnectMs: number
  private socket: RawSocket | null = null
  private authed = false
  private stopped = false
  private attempts = 0
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(opts: ConnectionOptions) {
    this.opts = opts
    this.factory = opts.socketFactory ?? defaultFactory
    this.reconnectMs = opts.reconnectMs ?? 1000
  }

  start(): void {
    void this.connect()
  }

  private status(s: ConnStatus): void {
    this.opts.onStatus?.(s)
  }

  private async connect(): Promise<void> {
    if (this.stopped) return
    this.authed = false
    this.status({ state: 'connecting' })
    let token: string
    try {
      token = await this.opts.getToken()
    } catch {
      this.scheduleReconnect()
      return
    }
    if (this.stopped) return

    const socket = this.factory(`${this.opts.wsUrl.replace(/\/$/, '')}/agent`, WS_SUBPROTOCOL, {
      Authorization: `Bearer ${token}`,
    })
    this.socket = socket

    socket.on('open', () => {
      const a = this.opts.availability()
      socket.send(
        JSON.stringify({
          type: 'hello',
          id: 'hello-1',
          protocol: PROTOCOL_VERSION,
          mode: a.mode,
          state: a.state,
          cwd: a.cwd,
          accept_task: a.acceptTask,
          agent: { name: 'pi', repo: a.repo },
        }),
      )
    })
    socket.on('message', (data) => this.onMessage(String(data)))
    socket.on('close', (code) => {
      this.socket = null
      this.authed = false
      if (!this.stopped) this.scheduleReconnect(typeof code === 'number' ? code : undefined)
    })
    socket.on('error', () => {
      /* the close handler drives reconnect */
    })
  }

  private onMessage(raw: string): void {
    let frame: CommandFrame
    try {
      frame = JSON.parse(raw)
    } catch {
      return
    }
    if (frame.type === 'response' && frame.command === 'hello') {
      this.authed = true
      this.attempts = 0
      const sessionId = String((frame.data as { session_id?: string })?.session_id ?? '')
      this.status({ state: 'ready', sessionId })
      return
    }
    if (frame.type === 'ready') return
    // Anything else the server sends post-handshake is a command to run.
    this.opts.onCommand(frame, (payload) => {
      this.socket?.send(
        JSON.stringify({ type: 'response', command: frame.type, id: frame.id, ...payload }),
      )
    })
  }

  /** Emit an event to the server (fanned out to the user's browsers). */
  sendEvent(frame: Record<string, unknown>): void {
    if (this.authed) this.socket?.send(JSON.stringify(frame))
  }

  private scheduleReconnect(code?: number): void {
    if (this.stopped) return
    this.status({ state: 'reconnecting', code })
    const delay = Math.min(this.reconnectMs * 2 ** this.attempts, 30_000)
    this.attempts += 1
    this.timer = setTimeout(() => void this.connect(), delay)
  }

  stop(): void {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.socket?.close(1000)
    this.socket = null
    this.status({ state: 'stopped' })
  }
}
