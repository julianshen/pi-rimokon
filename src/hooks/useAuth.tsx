// Auth state for the app — wraps Supabase OAuth behind a small context so
// any component can read the signed-in user or trigger sign-in / sign-out without
// threading props. The whole app is gated on this (see AuthGate).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out' | 'unconfigured'

/** OAuth providers wired up for sign-in (all brokered by Supabase). */
export type OAuthProvider = 'github'

/** A view-friendly identity derived from the provider profile Supabase returns. */
export interface Profile {
  name: string
  email: string
  avatarUrl: string | null
  initials: string
}

interface AuthValue {
  status: AuthStatus
  user: User | null
  profile: Profile | null
  signInWith: (provider: OAuthProvider) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

function initialsFrom(name: string, email: string): string {
  const source = name.trim() || email
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2)
  return letters.toUpperCase()
}

function profileFromUser(user: User): Profile {
  const meta = user.user_metadata ?? {}
  const email = user.email ?? meta.email ?? ''
  const name = (meta.full_name as string) || (meta.name as string) || email.split('@')[0] || 'Account'
  const avatarUrl = (meta.avatar_url as string) || (meta.picture as string) || null
  return { name, email, avatarUrl, initials: initialsFrom(name, email) }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    // Fires on sign-in, sign-out, token refresh, and after the OAuth redirect.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(() => {
    const status: AuthStatus = !isSupabaseConfigured
      ? 'unconfigured'
      : loading
        ? 'loading'
        : session
          ? 'signed-in'
          : 'signed-out'

    return {
      status,
      user: session?.user ?? null,
      profile: session?.user ? profileFromUser(session.user) : null,
      signInWith: async (provider) => {
        if (!supabase) return
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          // Return to the exact URL the user was on — origin in the common
          // case, but preserving the path + query for deep links like
          // /device?code=… so the device approval survives sign-in.
          options: { redirectTo: window.location.href },
        })
        // signInWithOAuth resolves with { error } instead of rejecting; surface
        // it so the caller can stop its loading state and show a message.
        if (error) throw error
      },
      signOut: async () => {
        if (!supabase) return
        await supabase.auth.signOut()
      },
    }
  }, [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>')
  return ctx
}
