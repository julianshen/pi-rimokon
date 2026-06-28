/**
 * Wire contract shared by the Pi Remote **server** and the **SPA**.
 *
 * This is the single source of truth for the `/agent` + `/client` WebSocket
 * protocol described in `docs/agent-endpoint-spec.md`. It is intentionally
 * dependency-free (types + plain const objects only) so it can be imported from
 * either side under any module/runtime configuration.
 *
 * Scope note (M0): only the protocol *constants* and *envelope types* live here.
 * The connection/broker logic that uses them lands in later milestones (M2/M3).
 */

/** `hello.protocol` version string, `<name>/<major>` form (spec §4.1). */
export const PROTOCOL_VERSION = 'pi.rpc/1' as const

/**
 * WebSocket subprotocol token sent in `Sec-WebSocket-Protocol` (spec §4.1).
 * Dot-separated because the header must be a valid token; the *major* must
 * match {@link PROTOCOL_VERSION}, only the surface syntax differs.
 */
export const WS_SUBPROTOCOL = 'pi.rpc.v1' as const

/** Max bytes per WebSocket text frame; oversized → {@link CLOSE_CODES.TOO_LARGE} (spec §4.2). */
export const MAX_FRAME_BYTES = 1024 * 1024 // 1 MiB

/** WebSocket close codes (spec §4.4). */
export const CLOSE_CODES = {
  /** normal closure */
  NORMAL: 1000,
  /** protocol error / bad frame / unsupported version */
  PROTOCOL_ERROR: 4400,
  /** missing / invalid / expired token */
  UNAUTHORIZED: 4401,
  /** token revoked, or session not owned by the user */
  FORBIDDEN: 4403,
  /** idle / heartbeat timeout / handshake not completed in time */
  TIMEOUT: 4408,
  /** duplicate session (same agent token already connected) */
  DUPLICATE_SESSION: 4409,
  /** frame too large */
  TOO_LARGE: 4413,
  /** internal server error */
  INTERNAL: 1011,
} as const

export type CloseCode = (typeof CLOSE_CODES)[keyof typeof CLOSE_CODES]

/** RFC 8628 device-flow polling error states (spec §3.1). */
export const DEVICE_FLOW_ERRORS = [
  'authorization_pending',
  'slow_down',
  'access_denied',
  'expired_token',
] as const

export type DeviceFlowError = (typeof DEVICE_FLOW_ERRORS)[number]

// --- Pi RPC envelope (spec §1, §4.2) ---------------------------------------

/** A command frame (server → agent). */
export interface CommandFrame {
  type: string
  id?: string
  [field: string]: unknown
}

/** A response frame (agent → server), correlated to a command by `id`. */
export interface ResponseFrame {
  type: 'response'
  command: string
  id?: string
  success: boolean
  data?: Record<string, unknown>
  error?: string
}

/** An unsolicited event frame (agent → server); carries a monotonic `seq`. */
export interface EventFrame {
  type: string
  seq?: number
  [field: string]: unknown
}

/** Any frame carried over the raw Pi socket. */
export type PiFrame = CommandFrame | ResponseFrame | EventFrame

/**
 * `/client` multiplexing envelope (spec §5.2): a web client addresses a target
 * agent by `session_id`; the inner payload is a pure Pi frame.
 */
export type ClientEnvelope = PiFrame & { session_id?: string }
