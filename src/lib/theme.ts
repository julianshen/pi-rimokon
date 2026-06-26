// Design tokens for the Pi Remote UI. Colors are CSS-variable references (see
// global.css), so a single `data-theme` switch on <html> repaints light/dark.
// Components read these tokens instead of hardcoding hex.

export const colors = {
  paper: 'var(--pi-paper)',
  ink: 'var(--pi-text)',
  sidebar: 'var(--pi-sidebar)',
  surface: 'var(--pi-surface)',
  surfaceMuted: 'var(--pi-surface-muted)',
  surfaceMuted2: 'var(--pi-surface-muted2)',
  border: 'var(--pi-border)',
  borderCard: 'var(--pi-border-card)',
  borderHair: 'var(--pi-border-hair)',
  text: 'var(--pi-text)',
  textBody: 'var(--pi-text-body)',
  textSoft: 'var(--pi-text-soft)',
  textMuted: 'var(--pi-text-muted)',
  textFaint: 'var(--pi-text-faint)',
  textFainter: 'var(--pi-text-fainter)',
  green: 'var(--pi-green)',
  greenDark: 'var(--pi-green-dark)',
  greenSoft: 'var(--pi-green-soft)',
  amber: 'var(--pi-amber)',
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

/** Read the persisted theme mode, defaulting to "system" when absent/invalid.
 *  Storage access can throw (private mode / sandboxed iframe); fall back to
 *  "system" rather than crashing the initial render. */
export function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored && (THEME_MODES as string[]).includes(stored) ? (stored as ThemeMode) : 'system'
  } catch {
    return 'system'
  }
}

/** Persist the chosen theme mode (no-op if storage is blocked). */
export function storeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Storage unavailable (privacy mode / sandboxed iframe): theme just won't persist.
  }
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
  working: { key: 'working', label: 'Working', color: 'var(--pi-amber)', bg: 'var(--pi-amber-soft)', pulse: true },
  review: { key: 'review', label: 'Needs review', color: 'var(--pi-blue)', bg: 'var(--pi-blue-soft)', pulse: false },
  waiting: { key: 'waiting', label: 'Waiting on you', color: 'var(--pi-purple)', bg: 'var(--pi-purple-soft)', pulse: true },
  done: { key: 'done', label: 'Done', color: 'var(--pi-green)', bg: 'var(--pi-green-soft)', pulse: false },
  error: { key: 'error', label: 'Failed', color: 'var(--pi-red)', bg: 'var(--pi-red-soft)', pulse: false },
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

// Each tool kind carries both its accent color and the icon-chip background, so
// the two stay in sync (no separate color→bg mapping to keep aligned).
export const TOOL_META: Record<ToolKind, { icon: IconName; verb: string; color: string; bg: string }> = {
  read: { icon: 'file', verb: 'Read', color: 'var(--pi-text-muted)', bg: 'var(--pi-border-hair)' },
  search: { icon: 'search', verb: 'Search', color: 'var(--pi-text-muted)', bg: 'var(--pi-border-hair)' },
  edit: { icon: 'pencil', verb: 'Edit', color: 'var(--pi-blue)', bg: 'var(--pi-blue-soft)' },
  create: { icon: 'create', verb: 'Create', color: 'var(--pi-green)', bg: 'var(--pi-green-soft)' },
  bash: { icon: 'terminal', verb: 'Run', color: 'var(--pi-text-body)', bg: 'var(--pi-surface-alt)' },
  test: { icon: 'check', verb: 'Test', color: 'var(--pi-green)', bg: 'var(--pi-green-soft)' },
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
    '+': { bg: 'var(--pi-diff-add-bg)', fg: 'var(--pi-diff-add-fg)', sign: '+' },
    '-': { bg: 'var(--pi-diff-del-bg)', fg: 'var(--pi-diff-del-fg)', sign: '−' },
    ' ': { bg: 'transparent', fg: 'var(--pi-text-context)', sign: ' ' },
    '@': { bg: 'var(--pi-diff-hunk-bg)', fg: 'var(--pi-diff-hunk-fg)', sign: '' },
  }
  return map[t] ?? map[' ']
}

export type DiffSign = '+' | '-' | ' ' | '@'

// Changed-file status badge (Added / Modified / Deleted).
export function fileBadgeColors(status: string): { c: string; bg: string } {
  const map: Record<string, { c: string; bg: string }> = {
    A: { c: 'var(--pi-green)', bg: 'var(--pi-green-soft)' },
    M: { c: 'var(--pi-blue)', bg: 'var(--pi-blue-soft)' },
    D: { c: 'var(--pi-red)', bg: 'var(--pi-red-soft)' },
  }
  return map[status] ?? map.M
}
