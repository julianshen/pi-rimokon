import { describe, expect, it } from 'vitest'
import { CLOSE_CODES, MAX_FRAME_BYTES } from '../../shared/protocol.ts'
import { parseFrame } from '../src/ws/framing.ts'

describe('parseFrame', () => {
  it('accepts a single JSON object', () => {
    expect(parseFrame('{"type":"hello"}', false)).toEqual({ ok: true, frame: { type: 'hello' } })
  })

  it('rejects binary frames with 4400', () => {
    expect(parseFrame('anything', true)).toEqual({ ok: false, code: CLOSE_CODES.PROTOCOL_ERROR })
  })

  it('rejects frames over 1 MiB with 4413', () => {
    const big = `{"x":"${'a'.repeat(MAX_FRAME_BYTES)}"}`
    expect(parseFrame(big, false)).toEqual({ ok: false, code: CLOSE_CODES.TOO_LARGE })
  })

  it('rejects malformed JSON with 4400', () => {
    expect(parseFrame('{not json', false)).toEqual({ ok: false, code: CLOSE_CODES.PROTOCOL_ERROR })
  })

  it.each([['[1,2]'], ['42'], ['"str"'], ['null']])('rejects non-object JSON %s with 4400', (s) => {
    expect(parseFrame(s, false)).toEqual({ ok: false, code: CLOSE_CODES.PROTOCOL_ERROR })
  })
})
