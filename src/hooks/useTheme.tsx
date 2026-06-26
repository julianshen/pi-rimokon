// Global light/dark theme state. Mirrors the useAuth pattern: a provider holds
// the user's mode + the live system preference, derives the resolved theme, and
// applies it to <html> via `data-theme`. The pure logic lives in lib/theme.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyTheme,
  readStoredMode,
  resolveTheme,
  storeMode,
  systemPrefersDark,
  type ResolvedTheme,
  type ThemeMode,
} from '../lib/theme'

interface ThemeValue {
  /** The user's preference: light, dark, or follow-the-system. */
  mode: ThemeMode
  /** The concrete theme currently applied. */
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  /** Flip between light and dark (sets an explicit mode). */
  toggle: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode())
  const [prefersDark, setPrefersDark] = useState<boolean>(() => systemPrefersDark())

  const resolved = resolveTheme(mode, prefersDark)

  // Reflect the resolved theme onto <html> so the CSS variables swap.
  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  // Track live OS preference changes (relevant while mode is "system").
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    storeMode(next)
    setModeState(next)
  }, [])

  const toggle = useCallback(() => {
    setMode(resolveTheme(mode, prefersDark) === 'dark' ? 'light' : 'dark')
  }, [mode, prefersDark, setMode])

  const value = useMemo<ThemeValue>(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
