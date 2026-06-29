import { CLOSE_CODES, MAX_FRAME_BYTES } from '../../../shared/protocol.ts'

export type Frame = Record<string, unknown>
export type FrameResult = { ok: true; frame: Frame } | { ok: false; code: number }

/**
 * Validate a single inbound WebSocket frame against the spec §4.2 framing rules:
 * one JSON object per text frame, UTF-8, ≤1 MiB, no binary, no batching.
 * Returns the parsed object or the close code to reject with.
 */
export function parseFrame(data: string, isBinary: boolean): FrameResult {
  if (isBinary) return { ok: false, code: CLOSE_CODES.PROTOCOL_ERROR } // 4400: binary reserved
  if (Buffer.byteLength(data, 'utf8') > MAX_FRAME_BYTES) {
    return { ok: false, code: CLOSE_CODES.TOO_LARGE } // 4413
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return { ok: false, code: CLOSE_CODES.PROTOCOL_ERROR } // 4400: bad JSON
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, code: CLOSE_CODES.PROTOCOL_ERROR } // 4400: not a single object
  }
  return { ok: true, frame: parsed as Frame }
}
