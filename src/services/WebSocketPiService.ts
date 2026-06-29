import type { Session, ThreadMessage } from '../lib/types'
import type { PiService, SendMessageOptions, StartSessionParams } from './PiService'

/** Minimal socket surface (the browser `WebSocket` satisfies it structurally). */
export interface PiSocket {
  send(data: string): void
  close(): void
  onopen: ((ev?: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: ((ev?: unknown) => void) | null
}

export interface WebSocketPiServiceOptions {
  /** Server origin as a `wss://` URL (VITE_PI_SERVER_URL). */
  serverUrl: string
  /** Returns the current Supabase access token (for the ticket fetch). */
  getAccessToken: () => Promise<string | null>
  socketFactory?: (url: string) => PiSocket
  fetchFn?: typeof fetch
  /** Reconnect backoff base (ms); doubles each attempt up to a cap. */
  reconnectMs?: number
}

interface BrokerSession {
  session_id: string
  repo?: string | null
  state?: string
  accept_task?: boolean
}

/** Map an agent's idle/busy state onto the UI status badge. */
function statusFor(state: string | undefined): Session['status'] {
  return state === 'busy' ? 'working' : 'review'
}

function sessionFromDescriptor(d: BrokerSession): Session {
  const repo = d.repo ?? 'agent'
  return {
    id: d.session_id,
    title: repo,
    repo,
    branch: '',
    status: statusFor(d.state),
    model: 'pi',
    latest: d.state === 'busy' ? 'Working…' : 'Idle',
    time: 'now',
    add: 0,
    del: 0,
    live: d.state === 'busy',
    thread: [],
    changes: [],
    terminal: [],
    tree: [],
  }
}

/**
 * Live {@link PiService} backed by the Pi Remote Server `/client` socket
 * (spec §8). Connects with a single-use ticket, maps broker presence into the
 * session list, sends commands addressed by `session_id`, and folds inbound
 * events into the session view-model. Falls back to {@link MockPiService} when
 * `VITE_PI_SERVER_URL` is unset (wired in App). Auto-reconnects with backoff.
 */
export class WebSocketPiService implements PiService {
  private readonly opts: Required<Omit<WebSocketPiServiceOptions, 'serverUrl' | 'getAccessToken'>> &
    Pick<WebSocketPiServiceOptions, 'serverUrl' | 'getAccessToken'>
  private readonly httpsBase: string
  private readonly sessions = new Map<string, Session>()
  /** Ephemeral, client-only sessions (e.g. the "no agent available" notice). */
  private readonly local = new Map<string, Session>()
  private readonly listeners = new Set<() => void>()
  private socket: PiSocket | null = null
  private stopped = false
  private attempts = 0
  private cmdSeq = 0

  constructor(options: WebSocketPiServiceOptions) {
    this.opts = {
      socketFactory: (url) => new WebSocket(url) as unknown as PiSocket,
      fetchFn: (...args: Parameters<typeof fetch>) => fetch(...args),
      reconnectMs: 1000,
      ...options,
    }
    this.httpsBase = options.serverUrl.replace(/^ws/, 'http').replace(/\/$/, '')
    void this.connect()
  }

  // --- connection lifecycle ------------------------------------------------

  private async connect(): Promise<void> {
    if (this.stopped) return
    try {
      const token = await this.opts.getAccessToken()
      if (!token) throw new Error('not authenticated')
      const res = await this.opts.fetchFn(`${this.httpsBase}/client/ticket`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`ticket fetch failed: ${res.status}`)
      const { ticket } = (await res.json()) as { ticket: string }
      const wsUrl = `${this.opts.serverUrl.replace(/\/$/, '')}/client?ticket=${encodeURIComponent(ticket)}`
      const socket = this.opts.socketFactory(wsUrl)
      this.socket = socket
      socket.onopen = () => {
        this.attempts = 0
      }
      socket.onmessage = (ev) => this.onMessage(ev.data)
      socket.onclose = () => {
        this.socket = null
        this.scheduleReconnect()
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return
    const delay = Math.min(this.opts.reconnectMs * 2 ** this.attempts, 30_000)
    this.attempts += 1
    setTimeout(() => void this.connect(), delay)
  }

  /** Stop reconnecting and close the socket (on unmount / sign-out). */
  dispose(): void {
    this.stopped = true
    this.socket?.close()
    this.socket = null
  }

  // --- inbound broker messages ---------------------------------------------

  private onMessage(raw: unknown): void {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(String(raw))
    } catch {
      return
    }
    switch (msg.type) {
      case 'sessions': {
        this.sessions.clear()
        for (const d of (msg.sessions as BrokerSession[]) ?? []) {
          this.sessions.set(d.session_id, sessionFromDescriptor(d))
        }
        break
      }
      case 'session_online': {
        const d = msg as unknown as BrokerSession
        this.sessions.set(d.session_id, sessionFromDescriptor(d))
        break
      }
      case 'session_offline': {
        this.sessions.delete(String(msg.session_id))
        break
      }
      case 'agent_state': {
        const s = this.sessions.get(String(msg.session_id))
        if (s) {
          s.status = statusFor(String(msg.state))
          s.live = msg.state === 'busy'
          s.latest = msg.state === 'busy' ? 'Working…' : 'Idle'
        }
        break
      }
      case 'response':
        break // command acks; correlation is handled optimistically in the UI
      default:
        this.foldEvent(msg)
    }
    this.emit()
  }

  /** Best-effort fold of an agent event into its session thread. */
  private foldEvent(msg: Record<string, unknown>): void {
    const s = this.sessions.get(String(msg.session_id))
    if (!s) return
    const text = typeof msg.message === 'string' ? msg.message : typeof msg.text === 'string' ? msg.text : undefined
    if (text) {
      s.thread = [...s.thread, { role: 'agent', text }]
      s.latest = text.slice(0, 80)
    }
  }

  private send(frame: Record<string, unknown>): void {
    this.socket?.send(JSON.stringify({ ...frame, id: `c${(this.cmdSeq += 1)}` }))
  }

  // --- PiService ------------------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    this.listeners.forEach((l) => l())
  }

  listSessions(): Session[] {
    return [...this.local.values(), ...this.sessions.values()]
  }

  getSession(id: string): Session | undefined {
    return this.local.get(id) ?? this.sessions.get(id)
  }

  startSession(params: StartSessionParams): Session {
    // §5.4: the browser can't spawn — select an already-connected idle agent.
    const idle = [...this.sessions.values()].find(
      (s) => !s.live && (!params.repo || s.repo === params.repo),
    )
    if (idle) {
      this.send({ type: 'start_session', repo: params.repo, prompt: params.prompt, session_id: idle.id })
      idle.thread = [...idle.thread, { role: 'user', text: params.prompt }]
      this.emit()
      return idle
    }
    // No agent available — surface a notice in a client-only session.
    const id = `local_${(this.cmdSeq += 1)}`
    const notice: ThreadMessage = {
      role: 'agent',
      text: `No connected agent is available for ${params.repo || 'this repo'}. Run \`pi\` in the repo to start one, then try again.`,
    }
    const session: Session = {
      ...sessionFromDescriptor({ session_id: id, repo: params.repo }),
      title: params.prompt.slice(0, 52) || params.repo,
      thread: [{ role: 'user', text: params.prompt }, notice],
      latest: 'No agent available',
    }
    this.local.set(id, session)
    this.emit()
    return session
  }

  sendMessage(sessionId: string, text: string, _opts: SendMessageOptions): void {
    const s = this.sessions.get(sessionId)
    if (s) {
      s.thread = [...s.thread, { role: 'user', text }]
      this.emit()
    }
    this.send({ type: 'steer', session_id: sessionId, message: text })
  }

  pickOption(sessionId: string, option: string): void {
    this.send({ type: 'pick_option', session_id: sessionId, option })
  }

  stopRun(sessionId: string): void {
    this.send({ type: 'stop', session_id: sessionId })
  }
}
