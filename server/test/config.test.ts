import { describe, expect, it } from 'vitest'
import { ConfigError, loadConfig } from '../src/config.ts'

const DB = 'postgresql://user:pass@localhost:5432/db'

describe('loadConfig', () => {
  it('parses a valid environment and defaults PORT to 8787', () => {
    const config = loadConfig({ DATABASE_URL: DB } as NodeJS.ProcessEnv)
    expect(config.PORT).toBe(8787)
    expect(config.DATABASE_URL).toBe(DB)
    expect(config.ALLOWED_ORIGIN).toBeUndefined()
  })

  it('coerces a string PORT to a number and keeps ALLOWED_ORIGIN', () => {
    const config = loadConfig({
      DATABASE_URL: DB,
      PORT: '3000',
      ALLOWED_ORIGIN: 'https://pi-rimokon.vercel.app',
    } as NodeJS.ProcessEnv)
    expect(config.PORT).toBe(3000)
    expect(config.ALLOWED_ORIGIN).toBe('https://pi-rimokon.vercel.app')
  })

  it('throws ConfigError when DATABASE_URL is missing', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(ConfigError)
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/)
  })

  it('throws when PORT is out of range', () => {
    expect(() =>
      loadConfig({ DATABASE_URL: DB, PORT: '70000' } as NodeJS.ProcessEnv),
    ).toThrow(ConfigError)
  })

  it('throws when ALLOWED_ORIGIN is not a URL', () => {
    expect(() =>
      loadConfig({ DATABASE_URL: DB, ALLOWED_ORIGIN: 'not-a-url' } as NodeJS.ProcessEnv),
    ).toThrow(/ALLOWED_ORIGIN/)
  })
})
