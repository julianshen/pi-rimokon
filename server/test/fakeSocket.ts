import type { AgentSocket } from '../src/ws/agent.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (...args: any[]) => void

/** A scriptable in-memory {@link AgentSocket} for driving the handler in tests. */
export class FakeSocket implements AgentSocket {
  readonly sent: string[] = []
  readonly closes: number[] = []
  pings = 0
  private closedEmitted = false
  private readonly handlers: Record<string, Handler[]> = {}

  send(data: string): void {
    this.sent.push(data)
  }

  close(code: number): void {
    this.closes.push(code)
    if (!this.closedEmitted) {
      this.closedEmitted = true
      this.emit('close')
    }
  }

  ping(): void {
    this.pings += 1
  }

  on(event: 'message', cb: (data: string, isBinary: boolean) => void): void
  on(event: 'pong', cb: () => void): void
  on(event: 'close', cb: () => void): void
  on(event: 'message' | 'pong' | 'close', cb: Handler): void {
    ;(this.handlers[event] ??= []).push(cb)
  }

  private emit(event: string, ...args: unknown[]): void {
    for (const h of this.handlers[event] ?? []) h(...args)
  }

  // --- test drivers ---
  deliver(frame: unknown, isBinary = false): void {
    this.emit('message', typeof frame === 'string' ? frame : JSON.stringify(frame), isBinary)
  }

  pong(): void {
    this.emit('pong')
  }

  get lastClose(): number | undefined {
    return this.closes.at(-1)
  }

  frames(): Array<Record<string, unknown>> {
    return this.sent.map((s) => JSON.parse(s) as Record<string, unknown>)
  }
}

/** Let queued microtasks (async handshake/DB work) settle. */
export function flush(ms = 25): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
