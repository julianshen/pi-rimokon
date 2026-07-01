import { describe, expect, it } from 'vitest'
import { loadConfig, toHttpBase } from '../src/config.ts'

describe('toHttpBase', () => {
  it('maps ws→http and wss→https, trimming a trailing slash', () => {
    expect(toHttpBase('wss://agents.jlnshen.com')).toBe('https://agents.jlnshen.com')
    expect(toHttpBase('ws://localhost:8787/')).toBe('http://localhost:8787')
  })
})

describe('loadConfig', () => {
  it('defaults to the deployed server when PI_REMOTE_SERVER_URL is unset', () => {
    const c = loadConfig({} as NodeJS.ProcessEnv)
    expect(c.wsUrl).toBe('wss://agents.jlnshen.com')
    expect(c.httpBase).toBe('https://agents.jlnshen.com')
    expect(c.clientId).toBe('pi-agent-cli')
    expect(c.credentialsPath).toMatch(/\.pi\/agent\/remote-control\/credentials\.json$/)
  })

  it('honors PI_REMOTE_SERVER_URL + PI_REMOTE_CLIENT_ID overrides', () => {
    const c = loadConfig({ PI_REMOTE_SERVER_URL: 'wss://dev.local:9000/', PI_REMOTE_CLIENT_ID: 'my-cli' } as NodeJS.ProcessEnv)
    expect(c.wsUrl).toBe('wss://dev.local:9000')
    expect(c.httpBase).toBe('https://dev.local:9000')
    expect(c.clientId).toBe('my-cli')
  })

  it('lets an explicit override URL win over env + default', () => {
    const c = loadConfig({ PI_REMOTE_SERVER_URL: 'wss://from-env' } as NodeJS.ProcessEnv, 'wss://from-arg:8787/')
    expect(c.wsUrl).toBe('wss://from-arg:8787')
    expect(c.httpBase).toBe('https://from-arg:8787')
  })
})
