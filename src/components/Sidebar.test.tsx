import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Sidebar } from './Sidebar'
import { ThemeProvider } from '../hooks/useTheme'
import { AuthProvider } from '../hooks/useAuth'
import { MockPiService } from '../services/MockPiService'
import type { Session } from '../lib/types'
import type { Route } from '../hooks/useAppStore'

const sessions: Session[] = new MockPiService().listSessions()

function renderSidebar(props: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  const onHome = vi.fn()
  const onSettings = vi.fn()
  const onOpenSession = vi.fn()
  const merged: React.ComponentProps<typeof Sidebar> = {
    route: 'home' as Route,
    sessions,
    activeId: sessions[0].id,
    onHome,
    onSettings,
    onOpenSession,
    ...props,
  }
  const ui: ReactElement = (
    <ThemeProvider>
      <AuthProvider>
        <Sidebar {...merged} />
      </AuthProvider>
    </ThemeProvider>
  )
  return { ...render(ui), onHome, onSettings, onOpenSession }
}

describe('Sidebar', () => {
  beforeEach(() => {
    // Start each test from a known light theme regardless of run order.
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders the brand, nav, and every session title', () => {
    renderSidebar()
    expect(screen.getByText('Pi Remote')).toBeInTheDocument()
    // Exact names: a session title ("…toggle to settings") would match /settings/i.
    expect(screen.getByRole('button', { name: 'Sessions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText('Active sessions')).toBeInTheDocument()
    for (const s of sessions) {
      expect(screen.getByText(s.title)).toBeInTheDocument()
    }
  })

  it('falls back to the Account label when no profile is configured', () => {
    renderSidebar()
    // Supabase is unconfigured in tests → no profile, so the name falls back.
    expect(screen.getByText('Account')).toBeInTheDocument()
  })

  it('fires nav callbacks on click', async () => {
    const user = userEvent.setup()
    const { onHome, onSettings } = renderSidebar()
    await user.click(screen.getByRole('button', { name: 'Sessions' }))
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onHome).toHaveBeenCalledTimes(1)
    expect(onSettings).toHaveBeenCalledTimes(1)
  })

  it('opens a session when its row is clicked', async () => {
    const user = userEvent.setup()
    const { onOpenSession } = renderSidebar()
    await user.click(screen.getByText(sessions[1].title))
    expect(onOpenSession).toHaveBeenCalledWith(sessions[1].id)
  })

  it('marks the active session row when on the session route', () => {
    // Branch: route === 'session' && id === activeId → selected styling path.
    renderSidebar({ route: 'session', activeId: sessions[0].id })
    expect(screen.getByText(sessions[0].title)).toBeInTheDocument()
  })

  it('renders no selected row on the home route (inactive branch)', () => {
    // Branch: route !== 'session' → selected is false for all rows.
    renderSidebar({ route: 'home' })
    expect(screen.getByText(sessions[0].title)).toBeInTheDocument()
  })

  it('invokes sign-out from the profile footer', async () => {
    const user = userEvent.setup()
    renderSidebar()
    const signOut = screen.getByRole('button', { name: /sign out/i })
    expect(signOut).toBeInTheDocument()
    await user.click(signOut)
  })

  it('surfaces the theme toggle and flips the applied theme', async () => {
    const user = userEvent.setup()
    renderSidebar()
    const toggle = screen.getByRole('button', { name: /switch to dark theme/i })
    expect(toggle).toBeInTheDocument()
    await user.click(toggle)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument()
  })
})
