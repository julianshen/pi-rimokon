import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  resolveTheme,
  readStoredMode,
  storeMode,
  applyTheme,
  systemPrefersDark,
  THEME_STORAGE_KEY,
} from './theme'

describe('resolveTheme', () => {
  it('returns the explicit mode for light/dark regardless of system pref', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('light', false)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('dark', true)).toBe('dark')
  })
  it('follows the system preference when mode is "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('readStoredMode / storeMode', () => {
  beforeEach(() => localStorage.clear())
  it('defaults to "system" when nothing is stored', () => {
    expect(readStoredMode()).toBe('system')
  })
  it('round-trips a stored mode', () => {
    storeMode('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(readStoredMode()).toBe('dark')
    storeMode('light')
    expect(readStoredMode()).toBe('light')
    storeMode('system')
    expect(readStoredMode()).toBe('system')
  })
  it('ignores an invalid stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'banana')
    expect(readStoredMode()).toBe('system')
  })
})

describe('applyTheme', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'))
  it('sets data-theme on the document element', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

describe('systemPrefersDark', () => {
  it('reflects the matchMedia result', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    expect(systemPrefersDark()).toBe(true)
    spy.mockReturnValue({ matches: false } as MediaQueryList)
    expect(systemPrefersDark()).toBe(false)
    spy.mockRestore()
  })
})
