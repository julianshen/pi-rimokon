import { MockPiService } from './MockPiService'
import type { PiService } from './PiService'
import { WebSocketPiService } from './WebSocketPiService'

/**
 * Pick the transport for the session: the live WebSocket service when
 * `VITE_PI_SERVER_URL` is configured, otherwise the in-memory mock (spec §8).
 */
export function createPiService(
  serverUrl: string | undefined,
  getAccessToken: () => Promise<string | null>,
): PiService {
  if (serverUrl) return new WebSocketPiService({ serverUrl, getAccessToken })
  return new MockPiService()
}
