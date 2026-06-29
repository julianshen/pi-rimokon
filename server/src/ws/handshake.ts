import { PROTOCOL_VERSION } from '../../../shared/protocol.ts'
import type { Frame } from './framing.ts'

/** Extract the major version from a `<name>/<major>` protocol string. */
export function protocolMajor(version: unknown): string | undefined {
  if (typeof version !== 'string') return undefined
  return /^[^/]+\/(\d+)$/.exec(version)?.[1]
}

/** The major this server speaks (from {@link PROTOCOL_VERSION}, e.g. "1"). */
export const SERVER_MAJOR = protocolMajor(PROTOCOL_VERSION) as string

/** Availability advertised by an agent in its hello (spec §4.1 / §5.4). */
export interface AgentAvailability {
  mode?: string
  state?: string
  cwd?: string
  repo?: string
  acceptTask: boolean
}

export type HandshakeResult =
  | { ok: true; availability: AgentAvailability; agent: Record<string, unknown> }
  | { ok: false; reason: 'not_hello' | 'bad_protocol' }

/**
 * Validate the first frame as a `hello` whose protocol major matches the
 * server (spec §4.1). Pulls out the agent descriptor + §5.4 availability.
 */
export function validateHello(frame: Frame): HandshakeResult {
  if (frame.type !== 'hello') return { ok: false, reason: 'not_hello' }
  if (protocolMajor(frame.protocol) !== SERVER_MAJOR) return { ok: false, reason: 'bad_protocol' }

  const agent = (typeof frame.agent === 'object' && frame.agent !== null ? frame.agent : {}) as Record<
    string,
    unknown
  >
  return {
    ok: true,
    agent,
    availability: {
      mode: typeof frame.mode === 'string' ? frame.mode : undefined,
      state: typeof frame.state === 'string' ? frame.state : undefined,
      cwd: typeof frame.cwd === 'string' ? frame.cwd : undefined,
      repo: typeof agent.repo === 'string' ? agent.repo : undefined,
      acceptTask: frame.accept_task === true,
    },
  }
}
