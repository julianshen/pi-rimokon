import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthValue } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'
import { LoginScreen } from './LoginScreen'

// Drive every LoginScreen branch by stubbing useAuth. The signed-out GitHub-button
// path is otherwise unreachable in tests (no Supabase env -> 'unconfigured').
const authState = vi.hoisted(() => ({ value: null as AuthValue | null }))
vi.mock('../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useAuth')>()
  return { ...actual, useAuth: () => authState.value }
})

function mockSystemLight() {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList)
}

function makeAuth(over: Partial<AuthValue>): AuthValue {
  return {
    status: 'unconfigured',
    user: null,
    profile: null,
    signInWith: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...over,
  }
}

function renderLogin() {
  return render(
    <ThemeProvider>
      <LoginScreen />
    </ThemeProvider>,
  )
}

describe('LoginScreen (unconfigured)', () => {
  beforeEach(() => {
    mockSystemLight()
    authState.value = makeAuth({ status: 'unconfigured' })
  })

  it('shows the brand, heading and tagline', () => {
    renderLogin()
    expect(screen.getByText('π')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pi Remote' })).toBeInTheDocument()
    expect(screen.getByText(/reach your coding sessions/i)).toBeInTheDocument()
  })

  it('renders the not-configured notice with the required env var names', () => {
    renderLogin()
    expect(screen.getByText(/Sign-in isn't configured yet/i)).toBeInTheDocument()
    expect(screen.getByText('VITE_SUPABASE_URL')).toBeInTheDocument()
    expect(screen.getByText('VITE_SUPABASE_ANON_KEY')).toBeInTheDocument()
    // the GitHub sign-in button is not reachable when unconfigured
    expect(screen.queryByRole('button', { name: /Continue with GitHub/i })).not.toBeInTheDocument()
  })

  it('includes a theme toggle', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /switch to (dark|light) theme/i })).toBeInTheDocument()
  })
})

describe('LoginScreen (signed-out branch)', () => {
  beforeEach(() => mockSystemLight())

  it('renders a GitHub sign-in button and calls signInWith on click', async () => {
    const user = userEvent.setup()
    const signInWith = vi.fn(async () => {})
    authState.value = makeAuth({ status: 'signed-out', signInWith })
    renderLogin()
    const btn = screen.getByRole('button', { name: /Continue with GitHub/i })
    await user.click(btn)
    expect(signInWith).toHaveBeenCalledWith('github')
    // success keeps the button in its connecting state (redirect is imminent)
    expect(screen.getByRole('button', { name: /Connecting…/i })).toBeInTheDocument()
  })

  it('shows an error message when sign-in fails with an Error', async () => {
    const user = userEvent.setup()
    const signInWith = vi.fn(async () => {
      throw new Error('OAuth blew up')
    })
    authState.value = makeAuth({ status: 'signed-out', signInWith })
    renderLogin()
    await user.click(screen.getByRole('button', { name: /Continue with GitHub/i }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('OAuth blew up')
    // failure resets the button back to its label
    expect(screen.getByRole('button', { name: /Continue with GitHub/i })).toBeInTheDocument()
  })

  it('shows a generic error message for a non-Error rejection', async () => {
    const user = userEvent.setup()
    const signInWith = vi.fn(async () => {
      throw 'string failure'
    })
    authState.value = makeAuth({ status: 'signed-out', signInWith })
    renderLogin()
    await user.click(screen.getByRole('button', { name: /Continue with GitHub/i }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Could not start sign-in/i)
  })
})
