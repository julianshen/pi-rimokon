import { homedir } from 'node:os'
import { join } from 'node:path'

export interface RemoteConfig {
  /** wss:// origin of the Pi Remote Server. */
  wsUrl: string
  /** matching https:// origin for the device-flow REST calls. */
  httpBase: string
  /** where the agent token (access + refresh) is persisted. */
  credentialsPath: string
  clientId: string
}

/** Swap a ws(s):// origin to http(s):// for REST calls (mirrors the SPA). */
export function toHttpBase(wsUrl: string): string {
  return wsUrl.replace(/^ws/, 'http').replace(/\/$/, '')
}

/** Default server origin when neither the command arg nor env override it. */
export const DEFAULT_SERVER_URL = 'wss://agents.jlnshen.com'

/**
 * Resolve config. Server origin precedence: `overrideUrl` (the `/remote-control`
 * argument) → `PI_REMOTE_SERVER_URL` → the deployed default. Credentials live
 * under ~/.pi/agent so the login survives across sessions (like `pi login`).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, overrideUrl?: string): RemoteConfig {
  const wsUrl = (overrideUrl || env.PI_REMOTE_SERVER_URL || DEFAULT_SERVER_URL).replace(/\/$/, '')
  return {
    wsUrl,
    httpBase: toHttpBase(wsUrl),
    credentialsPath: join(homedir(), '.pi', 'agent', 'remote-control', 'credentials.json'),
    clientId: env.PI_REMOTE_CLIENT_ID ?? 'pi-agent-cli',
  }
}
