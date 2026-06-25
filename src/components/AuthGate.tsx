import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LoginScreen } from './LoginScreen'
import { PiMark } from './icons'

// Gates the whole app on Google sign-in: a brief splash while the session is
// resolved, the login screen when signed out (or unconfigured), the app once in.
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return <Splash />
  if (status === 'signed-in') return <>{children}</>
  return <LoginScreen />
}

function Splash() {
  return (
    <div
      style={{
        height: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4f2ec',
      }}
    >
      <div style={{ animation: 'pi-pulse 1.4s infinite' }}>
        <PiMark tile={46} font={27} radius={13} />
      </div>
    </div>
  )
}
