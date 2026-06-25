// Design tokens ported from the Pi Remote prototype. Single source of truth for
// the warm paper/ink palette, the status language, and the tool-call styling.

export const colors = {
  paper: '#f4f2ec',
  ink: '#1b1b1d',
  sidebar: '#efece4',
  surface: '#ffffff',
  surfaceMuted: '#faf8f2',
  surfaceMuted2: '#fbfaf6',
  border: '#e2ded3',
  borderCard: '#e6e2d6',
  borderHair: '#f0ede4',
  text: '#1b1b1d',
  textBody: '#33312c',
  textSoft: '#5c594f',
  textMuted: '#76736b',
  textFaint: '#8a8678',
  textFainter: '#9b9788',
  green: '#1f8a5b',
  greenDark: '#1a7850',
  greenSoft: '#e6f2eb',
  amber: '#b9772a',
} as const

// ---- theme mode (light / dark / system) ----
// The active theme is driven by a `data-theme` attribute on <html>; the CSS
// variables in global.css resolve every palette token per theme. These helpers
// are the pure, testable core that the ThemeProvider wires together.

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'pi-theme'

const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']

/** Resolve the concrete theme to apply from the user's mode + system preference. */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}

/** Whether the OS currently prefers a dark color scheme. */
export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Read the persisted theme mode, defaulting to "system" when absent/invalid. */
export function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return stored && (THEME_MODES as string[]).includes(stored) ? (stored as ThemeMode) : 'system'
}

/** Persist the chosen theme mode. */
export function storeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_STORAGE_KEY, mode)
}

/** Apply the resolved theme by setting `data-theme` on <html>. */
export function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', resolved)
}

export type StatusKey = 'working' | 'review' | 'waiting' | 'done' | 'error'

export interface StatusDef {
  key: StatusKey
  label: string
  color: string
  bg: string
  pulse: boolean
}

export const STATUS: Record<StatusKey, StatusDef> = {
  working: { key: 'working', label: 'Working', color: '#b9772a', bg: '#f6ecdb', pulse: true },
  review: { key: 'review', label: 'Needs review', color: '#2f6db0', bg: '#e7eef7', pulse: false },
  waiting: { key: 'waiting', label: 'Waiting on you', color: '#7a5bd6', bg: '#efeafb', pulse: true },
  done: { key: 'done', label: 'Done', color: '#1f8a5b', bg: '#e6f2eb', pulse: false },
  error: { key: 'error', label: 'Failed', color: '#c0432f', bg: '#f7e7e3', pulse: false },
}

export function statusOf(key: StatusKey): StatusDef {
  return STATUS[key] ?? STATUS.working
}

// Pill + dot helpers (status chips used across cards, headers and the sidebar).
export function pillStyle(st: StatusDef): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 9px 3px 8px',
    borderRadius: 20,
    fontSize: 11.5,
    fontWeight: 600,
    color: st.color,
    background: st.bg,
  }
}

export function dotStyle(st: StatusDef, big = false): React.CSSProperties {
  const sz = big ? 7 : 6
  return {
    width: sz,
    height: sz,
    borderRadius: '50%',
    background: st.color,
    ...(st.pulse ? { animation: 'pi-pulse 1.4s infinite' } : {}),
  }
}

// Tool-call presentation (icon + verb + accent color per tool kind).
export type ToolKind = 'read' | 'search' | 'edit' | 'create' | 'bash' | 'test'

export const TOOL_META: Record<ToolKind, { icon: IconName; verb: string; color: string }> = {
  read: { icon: 'file', verb: 'Read', color: '#76736b' },
  search: { icon: 'search', verb: 'Search', color: '#76736b' },
  edit: { icon: 'pencil', verb: 'Edit', color: '#2f6db0' },
  create: { icon: 'create', verb: 'Create', color: '#1f8a5b' },
  bash: { icon: 'terminal', verb: 'Run', color: '#33312c' },
  test: { icon: 'check', verb: 'Test', color: '#1f8a5b' },
}

export function toolIconBg(color: string): string {
  if (color === '#76736b') return '#f0ede4'
  if (color === '#2f6db0') return '#e7eef7'
  if (color === '#1f8a5b') return '#e6f2eb'
  return '#ece9e1'
}

export type IconName =
  | 'file'
  | 'search'
  | 'pencil'
  | 'create'
  | 'terminal'
  | 'check'

// Single-path icon glyphs used inside tool cards.
export const TOOL_ICON_PATH: Record<IconName, string> = {
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M21 21l-4.3-4.3',
  pencil: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  create: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 11v6 M9 14h6',
  terminal: 'M4 17l6-6-6-6 M12 19h8',
  check: 'M20 6 9 17l-5-5',
}

// Diff line theming (added / removed / context / hunk header).
export function diffLineStyle(t: DiffSign): { bg: string; fg: string; sign: string } {
  const map: Record<DiffSign, { bg: string; fg: string; sign: string }> = {
    '+': { bg: '#e9f5ee', fg: '#1c6b44', sign: '+' },
    '-': { bg: '#fbeae5', fg: '#a8331f', sign: '−' },
    ' ': { bg: 'transparent', fg: '#6b6862', sign: ' ' },
    '@': { bg: '#f1edfb', fg: '#6a4cc0', sign: '' },
  }
  return map[t] ?? map[' ']
}

export type DiffSign = '+' | '-' | ' ' | '@'

// Changed-file status badge (Added / Modified / Deleted).
export function fileBadgeColors(status: string): { c: string; bg: string } {
  const map: Record<string, { c: string; bg: string }> = {
    A: { c: '#1f8a5b', bg: '#e6f2eb' },
    M: { c: '#2f6db0', bg: '#e7eef7' },
    D: { c: '#c0432f', bg: '#f7e7e3' },
  }
  return map[status] ?? map.M
}
