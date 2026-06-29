import { describe, expect, it } from 'vitest'
import { protocolMajor, SERVER_MAJOR, validateHello } from '../src/ws/handshake.ts'

describe('protocolMajor', () => {
  it('extracts the major from <name>/<major>', () => {
    expect(protocolMajor('pi.rpc/1')).toBe('1')
    expect(protocolMajor('pi.rpc/2')).toBe('2')
  })

  it('returns undefined for malformed versions', () => {
    expect(protocolMajor('pi.rpc')).toBeUndefined()
    expect(protocolMajor(42)).toBeUndefined()
  })

  it('server speaks major 1', () => {
    expect(SERVER_MAJOR).toBe('1')
  })
})

describe('validateHello', () => {
  it('accepts a matching hello and extracts availability', () => {
    const result = validateHello({
      type: 'hello',
      protocol: 'pi.rpc/1',
      mode: 'code',
      state: 'idle',
      cwd: '/work/app',
      accept_task: true,
      agent: { name: 'pi', repo: 'acme/web-app' },
    })
    expect(result).toEqual({
      ok: true,
      agent: { name: 'pi', repo: 'acme/web-app' },
      availability: {
        mode: 'code',
        state: 'idle',
        cwd: '/work/app',
        repo: 'acme/web-app',
        acceptTask: true,
      },
    })
  })

  it('rejects a non-hello first frame', () => {
    expect(validateHello({ type: 'steer' })).toEqual({ ok: false, reason: 'not_hello' })
  })

  it('rejects a mismatched protocol major', () => {
    expect(validateHello({ type: 'hello', protocol: 'pi.rpc/2' })).toEqual({
      ok: false,
      reason: 'bad_protocol',
    })
  })

  it('defaults acceptTask to false when absent', () => {
    const result = validateHello({ type: 'hello', protocol: 'pi.rpc/1' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.availability.acceptTask).toBe(false)
  })
})
