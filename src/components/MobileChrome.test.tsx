import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MobileTopBar, MobileNavDrawer } from './MobileChrome'
import { ThemeProvider } from '../hooks/useTheme'
import { AuthProvider } from '../hooks/useAuth'
import { MockPiService } from '../services/MockPiService'
import type { Session } from '../lib/types'

const sessions: Session[] = new MockPiService().listSessions()

function withProviders(node: ReactElement) {
  return (
    <ThemeProvider>
      <AuthProvider>{node}</AuthProvider>
    </ThemeProvider>
  )
}

describe('MobileTopBar', () => {
  it('renders the brand and a working nav toggle', async () => {
    const user = userEvent.setup()
    const onToggleNav = vi.fn()
    render(withProviders(<MobileTopBar onToggleNav={onToggleNav} />))
    expect(screen.getByText('Pi Remote')).toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    expect(onToggleNav).toHaveBeenCalledTimes(1)
  })
})

describe('MobileNavDrawer', () => {
  beforeEach(() => {
    // Start each test from a known light theme regardless of run order.
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  function renderDrawer() {
    const onClose = vi.fn()
    const onHome = vi.fn()
    const onSettings = vi.fn()
    const onOpenSession = vi.fn()
    render(
      withProviders(
        <MobileNavDrawer
          sessions={sessions}
          onClose={onClose}
          onHome={onHome}
          onSettings={onSettings}
          onOpenSession={onOpenSession}
        />,
      ),
    )
    return { onClose, onHome, onSettings, onOpenSession }
  }

  it('lists nav items, all sessions, and the account fallback', () => {
    renderDrawer()
    expect(screen.getByRole('button', { name: /^sessions$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^settings$/i })).toBeInTheDocument()
    expect(screen.getByText('Active sessions')).toBeInTheDocument()
    expect(screen.getByText('Account')).toBeInTheDocument()
    for (const s of sessions) {
      expect(screen.getByText(s.title)).toBeInTheDocument()
    }
  })

  it('fires nav + open-session callbacks', async () => {
    const user = userEvent.setup()
    const { onHome, onSettings, onOpenSession } = renderDrawer()
    await user.click(screen.getByRole('button', { name: /^sessions$/i }))
    await user.click(screen.getByRole('button', { name: /^settings$/i }))
    await user.click(screen.getByText(sessions[2].title))
    expect(onHome).toHaveBeenCalledTimes(1)
    expect(onSettings).toHaveBeenCalledTimes(1)
    expect(onOpenSession).toHaveBeenCalledWith(sessions[2].id)
  })

  it('closes when the backdrop overlay is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDrawer()
    // The overlay is the first sibling element rendered before the <aside>.
    const overlay = document.querySelector('div[style*="fixed"]') as HTMLElement
    expect(overlay).toBeTruthy()
    await user.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('invokes sign-out and exposes the theme toggle', async () => {
    const user = userEvent.setup()
    renderDrawer()
    await user.click(screen.getByRole('button', { name: /sign out/i }))
    const toggle = screen.getByRole('button', { name: /switch to dark theme/i })
    await user.click(toggle)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
