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
    // The desktop Sidebar renders an "Active sessions" section label; the mobile
    // top bar does not (and the nav drawer is closed initially). Its absence is a
    // mobile-only signal that the breakpoint switched.
    expect(screen.queryByText('Active sessions')).toBeNull()
    // The Home screen heading still renders in the mobile layout.
    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument()
  })

  it('reacts to a viewport resize without throwing', () => {
    setViewport(1280)
    renderApp()
    // At desktop width the Sidebar's "Active sessions" label is present.
    expect(screen.getByText('Active sessions')).toBeInTheDocument()
    act(() => {
      setViewport(600)
      window.dispatchEvent(new Event('resize'))
    })
    // After collapsing to mobile the desktop sidebar (and its label) is gone,
    // proving the breakpoint actually switched; the shell heading still renders.
    expect(screen.queryByText('Active sessions')).toBeNull()
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

  it('navigates to the Settings route from the sidebar', async () => {
    setViewport(1280)
    const user = userEvent.setup()
    renderApp()
    // Sidebar Settings entry → actions.goSettings → renders the Settings route
    // (which also mounts the new Agents card).
    const settings = screen.getAllByRole('button', { name: /settings/i })
    await user.click(settings[0])
    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument()
    expect(screen.getByText('Agent tokens')).toBeInTheDocument()
  })
})
