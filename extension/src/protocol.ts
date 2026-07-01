// Wire contract — kept in sync with the server's shared/protocol.ts. Duplicated
// (not imported) because the extension installs standalone under ~/.pi/agent.

export const PROTOCOL_VERSION = 'pi.rpc/1'
export const WS_SUBPROTOCOL = 'pi.rpc.v1'
export const MAX_FRAME_BYTES = 1024 * 1024

export const CLOSE_CODES = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  POLICY_VIOLATION: 1008,
  TRY_LATER: 1013,
  PROTOCOL_ERROR: 4400,
  UNAUTHORIZED: 4401,
  FORBIDDEN: 4403,
  TIMEOUT: 4408,
  DUPLICATE_SESSION: 4409,
  TOO_LARGE: 4413,
  INTERNAL: 1011,
} as const

/** A frame the server sends the agent (a Pi `command`). */
export interface CommandFrame {
  type: string
  id?: string
  [field: string]: unknown
}
