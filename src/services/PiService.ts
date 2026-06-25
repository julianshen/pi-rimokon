import type { Session } from '../lib/types'

export interface StartSessionParams {
  prompt: string
  repo: string
  model: string
  skills: Record<string, boolean>
}

export interface SendMessageOptions {
  /** true when the message steers an in-flight run, false for a fresh turn */
  steer: boolean
}

/**
 * Transport-agnostic contract for talking to Pi instances at remote.
 *
 * The UI depends only on this interface. `MockPiService` fulfils it with seeded
 * in-memory data + simulated agent replies; a production implementation would
 * back these calls with the real Pi RPC/SDK (e.g. websocket subscriptions for
 * streaming and HTTP/RPC for mutations) without changing any component.
 */
export interface PiService {
  /** All sessions across connected repos, in display order. */
  listSessions(): Session[]
  getSession(id: string): Session | undefined

  /** Spin up a fresh Pi instance in a new worktree. Returns the new session. */
  startSession(params: StartSessionParams): Session

  /** Append a user turn (or steer) to a session; the agent replies async. */
  sendMessage(sessionId: string, text: string, opts: SendMessageOptions): void

  /** Resolve an agent question by picking one of its offered options. */
  pickOption(sessionId: string, option: string): void

  /** Stop a live run. */
  stopRun(sessionId: string): void

  /** Subscribe to store mutations. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void
}
