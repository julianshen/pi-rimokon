import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// A controllable Supabase mock. Tests flip `mock.configured` and feed sessions
// / events through the captured handlers. Hoisted so the vi.mock factory can
// see it.
// ---------------------------------------------------------------------------
const mock = vi.hoisted(() => {
  return {
    configured: false,
    getSessionResult: { data: { session: null as unknown } },
    authChangeCb: null as null | ((event: string, session: unknown) => void),
    signInWithOAuth: vi.fn(async () => ({ error: null as unknown })),
    signOut: vi.fn(async () => ({ error: null })),
    unsubscribe: vi.fn(),
  }
})

vi.mock('../lib/supabase', () => {
  const client = {
    auth: {
      getSession: vi.fn(async () => mock.getSessionResult),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        mock.authChangeCb = cb
        return { data: { subscription: { unsubscribe: mock.unsubscribe } } }
      },
      signInWithOAuth: mock.signInWithOAuth,
      signOut: mock.signOut,
    },
  }
  return {
    get isSupabaseConfigured() {
      return mock.configured
    },
    get supabase() {
      return mock.configured ? client : null
    },
  }
})

// Import after the mock is registered.
import { AuthProvider, useAuth } from './useAuth'

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  mock.configured = false
  mock.getSessionResult = { data: { session: null } }
  mock.authChangeCb = null
  mock.signInWithOAuth.mockClear()
  mock.signInWithOAuth.mockResolvedValue({ error: null })
  mock.signOut.mockClear()
  mock.unsubscribe.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAuth — guard', () => {
  it('throws when used outside an <AuthProvider>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/)
  })
})

describe('useAuth — unconfigured (no env)', () => {
  it('reports "unconfigured", null user/profile, and safe no-op actions', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.status).toBe('unconfigured')
    expect(result.current.user).toBeNull()
    expect(result.current.profile).toBeNull()

    // no supabase client -> these resolve without throwing and never call the SDK
    await act(async () => {
      await result.current.signInWith('github')
      await result.current.signOut()
    })
    expect(mock.signInWithOAuth).not.toHaveBeenCalled()
    expect(mock.signOut).not.toHaveBeenCalled()
  })
})

describe('useAuth — configured', () => {
  it('starts in "loading" then resolves to "signed-out" when there is no session', async () => {
    mock.configured = true
    mock.getSessionResult = { data: { session: null } }
    const { result } = renderHook(() => useAuth(), { wrapper })
    // Before the async getSession resolves, status is loading.
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
    expect(result.current.user).toBeNull()
  })

  it('derives a signed-in profile from the session user metadata', async () => {
    mock.configured = true
    mock.getSessionResult = {
      data: {
        session: {
          user: {
            email: 'jane.doe@example.com',
            user_metadata: {
              full_name: 'Jane Doe',
              avatar_url: 'https://img/jane.png',
            },
          },
        },
      },
    }
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-in'))
    expect(result.current.profile).toEqual({
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      avatarUrl: 'https://img/jane.png',
      initials: 'JD',
    })
    expect(result.current.user).not.toBeNull()
  })

  it('derives initials from the email when no name is present, using picture as the avatar', async () => {
    mock.configured = true
    mock.getSessionResult = {
      data: {
        session: {
          user: {
            email: 'support@acme.io',
            user_metadata: { picture: 'https://img/p.png' },
          },
        },
      },
    }
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-in'))
    // name falls back to email local-part "support"; initials from that -> "SU"
    expect(result.current.profile?.name).toBe('support')
    expect(result.current.profile?.avatarUrl).toBe('https://img/p.png')
    expect(result.current.profile?.initials).toBe('SU')
  })

  it('uses metadata email and name fallbacks when the user has no top-level email', async () => {
    mock.configured = true
    mock.getSessionResult = {
      data: {
        session: {
          user: {
            // no top-level email -> falls back to meta.email
            user_metadata: { email: 'ops@team.dev', name: 'Ops Team' },
          },
        },
      },
    }
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-in'))
    expect(result.current.profile?.email).toBe('ops@team.dev')
    // name comes from meta.name; initials from the two words -> "OT"
    expect(result.current.profile?.name).toBe('Ops Team')
    expect(result.current.profile?.initials).toBe('OT')
  })

  it('defaults the name to "Account" and derives initials when nothing identifies the user', async () => {
    mock.configured = true
    mock.getSessionResult = {
      data: { session: { user: { user_metadata: {} } } },
    }
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-in'))
    expect(result.current.profile?.email).toBe('')
    // name -> 'Account' (no email/full_name/name); single-token source -> first 2 letters
    expect(result.current.profile?.name).toBe('Account')
    expect(result.current.profile?.initials).toBe('AC')
    expect(result.current.profile?.avatarUrl).toBeNull()
  })

  it('handles a user object with no user_metadata at all', async () => {
    mock.configured = true
    mock.getSessionResult = {
      data: { session: { user: { email: 'solo@x.io' } } },
    }
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-in'))
    // name falls back to the email local-part 'solo'; single token -> 'SO'
    expect(result.current.profile?.name).toBe('solo')
    expect(result.current.profile?.initials).toBe('SO')
  })

  it('updates state when the auth-change subscription fires (sign-in then sign-out)', async () => {
    mock.configured = true
    mock.getSessionResult = { data: { session: null } }
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-out'))

    act(() => {
      mock.authChangeCb?.('SIGNED_IN', { user: { email: 'a@b.com', user_metadata: {} } })
    })
    await waitFor(() => expect(result.current.status).toBe('signed-in'))

    act(() => {
      mock.authChangeCb?.('SIGNED_OUT', null)
    })
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
  })

  it('signInWith calls the SDK with the provider and the app origin', async () => {
    mock.configured = true
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
    await act(async () => {
      await result.current.signInWith('github')
    })
    expect(mock.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    })
  })

  it('signInWith surfaces an error returned by the SDK', async () => {
    mock.configured = true
    mock.signInWithOAuth.mockResolvedValueOnce({ error: new Error('nope') })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
    await expect(result.current.signInWith('github')).rejects.toThrow('nope')
  })

  it('signOut calls the SDK', async () => {
    mock.configured = true
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
    await act(async () => {
      await result.current.signOut()
    })
    expect(mock.signOut).toHaveBeenCalled()
  })

  it('unsubscribes from auth changes on unmount', async () => {
    mock.configured = true
    const { result, unmount } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('signed-out'))
    unmount()
    expect(mock.unsubscribe).toHaveBeenCalled()
  })
})
