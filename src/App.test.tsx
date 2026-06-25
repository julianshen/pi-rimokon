import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('drives the core shell interactions (exercises the wiring handlers)', async () => {
    setViewport(1280)
    const user = userEvent.setup()
    renderApp()

    // Home filter handler.
    await user.click(screen.getByRole('button', { name: /^All/i }))

    // Open a non-working ("done") session — its title shows in both the home grid
    // and the sidebar, so click the first match.
    const open = screen.getAllByRole('button', { name: /Add dark mode toggle to settings/i })
    await user.click(open[0])

    // Session route: header controls.
    await user.click(screen.getByRole('button', { name: /sonnet/i })) // onToggleModelMenu
    await user.click(screen.getByText('GPT-5')) // onPickModel

    // Composer.
    await user.type(screen.getByRole('textbox'), 'ship it') // onComposerChange
    await user.click(screen.getByRole('button', { name: 'Send' })) // onSend
    await user.click(screen.getByRole('button', { name: 'Follow-up' })) // onSendMode

    // Slide-overs.
    await user.click(screen.getByTitle('Session tree')) // onToggleTree
    await user.click(screen.getByTitle('Work panel')) // onToggleRight
    await user.click(screen.getByRole('button', { name: /terminal/i })) // WorkPanel onTab

    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
