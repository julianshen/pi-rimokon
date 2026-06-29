import { describe, it, expect } from 'vitest'
import { createPiService } from './createPiService'
import { MockPiService } from './MockPiService'
import { WebSocketPiService } from './WebSocketPiService'

describe('createPiService', () => {
  it('returns MockPiService when no server URL is configured', () => {
    const svc = createPiService(undefined, async () => null)
    expect(svc).toBeInstanceOf(MockPiService)
  })

  it('returns WebSocketPiService when a server URL is set', () => {
    // getAccessToken resolves null so connect() bails before any socket/fetch.
    const svc = createPiService('wss://srv.test', async () => null)
    expect(svc).toBeInstanceOf(WebSocketPiService)
    ;(svc as WebSocketPiService).dispose()
  })
})
