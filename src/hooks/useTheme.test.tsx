import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from './useTheme'

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
  vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList)
  return {
    emit: (next: boolean) => listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent)),
  }
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.restoreAllMocks()
  })

  it('defaults to system mode and applies the resolved theme to <html>', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.mode).toBe('system')
    expect(result.current.resolved).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('resolves dark when the system prefers dark', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.resolved).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('setMode persists the choice and applies it', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.setMode('dark'))
    expect(result.current.mode).toBe('dark')
    expect(result.current.resolved).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('pi-theme')).toBe('dark')
  })

  it('toggle flips between light and dark', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme(), { wrapper })
    act(() => result.current.toggle())
    expect(result.current.resolved).toBe('dark')
    act(() => result.current.toggle())
    expect(result.current.resolved).toBe('light')
  })

  it('reacts to a live system preference change while in system mode', () => {
    const mm = mockMatchMedia(false)
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.resolved).toBe('light')
    act(() => mm.emit(true))
    expect(result.current.resolved).toBe('dark')
  })

  it('throws when used outside of a ThemeProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useTheme())).toThrow(/ThemeProvider/)
  })
})
