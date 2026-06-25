import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { GoogleG, PiMark } from './icons'

// The auth gate. Rendered full-screen whenever no one is signed in, so the app
// (sidebar, sessions, everything) stays behind Google sign-in.
export function LoginScreen() {
  const { status, signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const unconfigured = status === 'unconfigured'

  const onSignIn = async () => {
    setBusy(true)
    setError(null)
    try {
      // On success this navigates away to Google, so `busy` simply stays true
      // until the redirect happens; we only reset it on failure.
      await signInWithGoogle()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in. Please try again.')
    }
  }

  return (
    <div
      style={{
        height: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4f2ec',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 372,
          background: '#fff',
          border: '1px solid #e6e2d6',
          borderRadius: 16,
          padding: '38px 32px 30px',
          boxShadow: '0 18px 50px rgba(40,36,28,.10)',
          animation: 'pi-rise .3s ease',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <PiMark tile={46} font={27} radius={13} />
        </div>

        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, letterSpacing: '-.02em' }}>Pi Remote</h1>
        <p style={{ margin: '0 0 26px', color: '#76736b', fontSize: 14.5, lineHeight: 1.45 }}>
          Sign in to reach your coding sessions across every repo.
        </p>

        {unconfigured ? (
          <ConfigNotice />
        ) : (
          <>
            <button
              className="pi-hover-border"
              onClick={onSignIn}
              disabled={busy}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 11,
                padding: '12px 14px',
                border: '1px solid #ddd8ca',
                borderRadius: 11,
                background: '#fff',
                color: '#1b1b1d',
                fontSize: 14.5,
                fontWeight: 600,
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.7 : 1,
                transition: 'border-color .15s ease',
              }}
            >
              <GoogleG size={18} />
              {busy ? 'Connecting…' : 'Continue with Google'}
            </button>

            {error && (
              <p role="alert" style={{ margin: '12px 0 0', color: '#c0432f', fontSize: 13, fontWeight: 500, lineHeight: 1.45 }}>
                {error}
              </p>
            )}

            <p style={{ margin: '20px 0 0', color: '#9b9788', fontSize: 11.5, lineHeight: 1.5 }}>
              We use Google only to verify it's you — your name, email, and avatar.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// Shown when the Supabase env vars are absent (e.g. a fresh clone). Keeps the app
// from white-screening and tells the developer exactly what to set.
function ConfigNotice() {
  return (
    <div
      style={{
        textAlign: 'left',
        background: '#faf8f2',
        border: '1px solid #ece9e1',
        borderRadius: 12,
        padding: '14px 16px',
        fontSize: 13,
        lineHeight: 1.55,
        color: '#5c594f',
      }}
    >
      <div style={{ fontWeight: 650, color: '#1b1b1d', marginBottom: 6 }}>Sign-in isn't configured yet</div>
      Set these environment variables, then reload:
      <div
        style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 12,
          marginTop: 8,
          color: '#33312c',
        }}
      >
        VITE_SUPABASE_URL
        <br />
        VITE_SUPABASE_ANON_KEY
      </div>
      <div style={{ marginTop: 8, color: '#9b9788', fontSize: 12 }}>See the README for the full Supabase + Google setup.</div>
    </div>
  )
}
