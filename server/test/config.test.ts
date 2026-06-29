import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from '../src/config.ts'

const BASE = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ISSUER: 'https://agents.example.com',
  AGENT_JWT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----',
  AGENT_JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nx\n-----END PUBLIC KEY-----',
  SUPABASE_URL: 'https://ref.supabase.co',
} as unknown as NodeJS.ProcessEnv

describe('loadConfig', () => {
  it('parses a valid environment and defaults PORT to 8787', () => {
    const config = loadConfig({ ...BASE })
    expect(config.PORT).toBe(8787)
    expect(config.DATABASE_URL).toBe(BASE.DATABASE_URL)
    expect(config.JWT_ISSUER).toBe(BASE.JWT_ISSUER)
    expect(config.ALLOWED_ORIGIN).toBeUndefined()
  })

  it('coerces a string PORT to a number and keeps ALLOWED_ORIGIN', () => {
    const config = loadConfig({
      ...BASE,
      PORT: '3000',
      ALLOWED_ORIGIN: 'https://pi-rimokon.vercel.app',
    } as NodeJS.ProcessEnv)
    expect(config.PORT).toBe(3000)
    expect(config.ALLOWED_ORIGIN).toBe('https://pi-rimokon.vercel.app')
  })

  it('throws ConfigError when DATABASE_URL is missing', () => {
    const { DATABASE_URL, ...rest } = BASE as Record<string, string>
    void DATABASE_URL
    expect(() => loadConfig(rest as NodeJS.ProcessEnv)).toThrow(ConfigError)
    expect(() => loadConfig(rest as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/)
  })

  it('throws when the signing keys are missing', () => {
    const { AGENT_JWT_PRIVATE_KEY, ...rest } = BASE as Record<string, string>
    void AGENT_JWT_PRIVATE_KEY
    expect(() => loadConfig(rest as NodeJS.ProcessEnv)).toThrow(ConfigError)
    expect(() => loadConfig(rest as NodeJS.ProcessEnv)).toThrow(/AGENT_JWT_PRIVATE_KEY/)
  })

  it('accepts 0 for the per-user caps (unlimited)', () => {
    const config = loadConfig({ ...BASE, MAX_SESSIONS_PER_USER: '0', MAX_CLIENTS_PER_USER: '0' } as NodeJS.ProcessEnv)
    expect(config.MAX_SESSIONS_PER_USER).toBe(0)
    expect(config.MAX_CLIENTS_PER_USER).toBe(0)
  })

  it('throws when PORT is out of range', () => {
    expect(() => loadConfig({ ...BASE, PORT: '70000' } as NodeJS.ProcessEnv)).toThrow(ConfigError)
  })

  it('throws when ALLOWED_ORIGIN is not a URL', () => {
    expect(() =>
      loadConfig({ ...BASE, ALLOWED_ORIGIN: 'not-a-url' } as NodeJS.ProcessEnv),
    ).toThrow(/ALLOWED_ORIGIN/)
  })
})
