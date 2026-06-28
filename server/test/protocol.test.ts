import { describe, expect, it } from 'vitest'
import {
  CLOSE_CODES,
  DEVICE_FLOW_ERRORS,
  MAX_FRAME_BYTES,
  PROTOCOL_VERSION,
  WS_SUBPROTOCOL,
} from '../../shared/protocol.ts'

// Verifies the shared wire contract imports cleanly on the server side and
// pins the spec §4.4 close codes against accidental drift.
describe('shared protocol contract', () => {
  it('exposes the spec §4 version + framing constants', () => {
    expect(PROTOCOL_VERSION).toBe('pi.rpc/1')
    expect(WS_SUBPROTOCOL).toBe('pi.rpc.v1')
    expect(MAX_FRAME_BYTES).toBe(1024 * 1024)
  })

  it('pins the spec §4.4 close codes', () => {
    expect(CLOSE_CODES).toEqual({
      NORMAL: 1000,
      PROTOCOL_ERROR: 4400,
      UNAUTHORIZED: 4401,
      FORBIDDEN: 4403,
      TIMEOUT: 4408,
      DUPLICATE_SESSION: 4409,
      TOO_LARGE: 4413,
      INTERNAL: 1011,
    })
  })

  it('lists the RFC 8628 polling error states', () => {
    expect(DEVICE_FLOW_ERRORS).toEqual([
      'authorization_pending',
      'slow_down',
      'access_denied',
      'expired_token',
    ])
  })
})
