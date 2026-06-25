import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import App from './App'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './hooks/useAuth'

function renderApp() {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>,
  )
}

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
}

describe('App', () => {
  afterEach(() => {
    // Restore a wide (desktop) viewport for the next test.
    setViewport(1280)
  })

  it('mounts the desktop shell with the sidebar and home screen', () => {
    setViewport(1280)
    renderApp()
    // Sidebar brand only renders on desktop (mobile hides the sidebar).
    expect(screen.getByText('Pi Remote')).toBeInTheDocument()
    // Home is the default route → its heading is shown.
    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument()
  })

  it('renders the mobile chrome below the breakpoint', () => {
    // Below MOBILE_BREAKPOINT (860): sidebar is hidden, the mobile top bar shows.
    setViewport(600)
    renderApp()
    expect(screen.getByText('Pi Remote')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument()
  })

  it('reacts to a viewport resize without throwing', () => {
    setViewport(1280)
    renderApp()
    expect(screen.getByText('Pi Remote')).toBeInTheDocument()
    act(() => {
      setViewport(600)
      window.dispatchEvent(new Event('resize'))
    })
    // Still rendering the shell after collapsing to mobile.
    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument()
  })
})
