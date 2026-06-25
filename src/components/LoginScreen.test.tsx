import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthValue } from '../hooks/useAuth'
import { ThemeProvider } from '../hooks/useTheme'
import { AuthProvider } from '../hooks/useAuth'
import { LoginScreen } from './LoginScreen'

function mockSystemLight() {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList)
}

describe('LoginScreen (real, unconfigured env)', () => {
  beforeEach(() => mockSystemLight())

  function renderReal() {
    return render(
      <ThemeProvider>
        <AuthProvider>
          <LoginScreen />
        </AuthProvider>
      </ThemeProvider>,
    )
  }

  it('shows the brand, heading and tagline', () => {
    renderReal()
    expect(screen.getByText('π')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pi Remote' })).toBeInTheDocument()
    expect(screen.getByText(/reach your coding sessions/i)).toBeInTheDocument()
  })

  it('renders the not-configured notice with the required env var names (no env)', () => {
    renderReal()
    expect(screen.getByText(/Sign-in isn't configured yet/i)).toBeInTheDocument()
    expect(screen.getByText('VITE_SUPABASE_URL')).toBeInTheDocument()
    expect(screen.getByText('VITE_SUPABASE_ANON_KEY')).toBeInTheDocument()
    // the GitHub sign-in button is not reachable when unconfigured
    expect(screen.queryByRole('button', { name: /Continue with GitHub/i })).not.toBeInTheDocument()
  })

  it('includes a theme toggle', () => {
    renderReal()
    expect(screen.getByRole('button', { name: /switch to (dark|light) theme/i })).toBeInTheDocument()
  })
})

// Drive the signed-out branch (GitHub button + busy + error handling) by stubbing
// useAuth, which is unreachable with no Supabase env configured.
const authState = vi.hoisted(() => ({ value: null as AuthValue | null }))
vi.mock('../hooks/useAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useAuth')>()
  return { ...actual, useAuth: () => authState.value }
})

describe('LoginScreen (signed-out branch)', () => {
  beforeEach(() => mockSystemLight())

  function renderSignedOut(signInWith: AuthValue['signInWith']) {
    authState.value = {
      status: 'signed-out',
      user: null,
      profile: null,
      signInWith,
      signOut: vi.fn(async () => {}),
    }
    return render(
      <ThemeProvider>
        <LoginScreen />
      </ThemeProvider>,
    )
  }

  it('renders a GitHub sign-in button and calls signInWith on click', async () => {
    const user = userEvent.setup()
    const signInWith = vi.fn(async () => {})
    renderSignedOut(signInWith)
    const btn = screen.getByRole('button', { name: /Continue with GitHub/i })
    await user.click(btn)
    expect(signInWith).toHaveBeenCalledWith('github')
  })

  it('shows an error message when sign-in fails', async () => {
    const user = userEvent.setup()
    const signInWith = vi.fn(async () => {
      throw new Error('OAuth blew up')
    })
    renderSignedOut(signInWith)
    await user.click(screen.getByRole('button', { name: /Continue with GitHub/i }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('OAuth blew up')
  })

  it('shows a generic error message for a non-Error rejection', async () => {
    const user = userEvent.setup()
    const signInWith = vi.fn(async () => {
      throw 'string failure'
    })
    renderSignedOut(signInWith)
    await user.click(screen.getByRole('button', { name: /Continue with GitHub/i }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Could not start sign-in/i)
  })
})
