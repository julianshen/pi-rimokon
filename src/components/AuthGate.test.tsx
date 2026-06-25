import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { AuthStatus, AuthValue } from '../hooks/useAuth'
import { AuthGate } from './AuthGate'
import { ThemeProvider } from '../hooks/useTheme'

// The auth state is provided by useAuth; stub it so we can drive every gate
// branch (loading / signed-in / signed-out / unconfigured) deterministically.
const authState = vi.hoisted(() => ({ value: null as AuthValue | null }))

vi.mock('../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useAuth')>()
  return { ...actual, useAuth: () => authState.value }
})

function makeAuth(status: AuthStatus): AuthValue {
  return {
    status,
    user: null,
    profile: null,
    signInWith: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  }
}

function renderGate() {
  return render(
    <ThemeProvider>
      <AuthGate>
        <div data-testid="app-content">the app</div>
      </AuthGate>
    </ThemeProvider>,
  )
}

describe('AuthGate', () => {
  beforeEach(() => {
    authState.value = makeAuth('loading')
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
  })

  it('shows the splash (the π mark) while loading, not the app', () => {
    authState.value = makeAuth('loading')
    renderGate()
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument()
    expect(screen.getByText('π')).toBeInTheDocument()
  })

  it('renders the children once signed in', () => {
    authState.value = makeAuth('signed-in')
    renderGate()
    expect(screen.getByTestId('app-content')).toBeInTheDocument()
  })

  it('renders the login screen when signed out', () => {
    authState.value = makeAuth('signed-out')
    renderGate()
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pi Remote' })).toBeInTheDocument()
  })

  it('renders the login screen (config notice) when unconfigured', () => {
    authState.value = makeAuth('unconfigured')
    renderGate()
    expect(screen.queryByTestId('app-content')).not.toBeInTheDocument()
    expect(screen.getByText(/Sign-in isn't configured yet/i)).toBeInTheDocument()
  })
})
