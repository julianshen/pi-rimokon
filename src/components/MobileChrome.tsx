import type { Session } from '../lib/types'
import { dotStyle, statusOf } from '../lib/theme'
import { LogoutIcon, MenuIcon, PiMark } from './icons'
import { Avatar } from './Avatar'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '../hooks/useAuth'

interface TopBarProps {
  onToggleNav: () => void
}

export function MobileTopBar({ onToggleNav }: TopBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderBottom: '1px solid var(--pi-border)',
        background: 'var(--pi-sidebar)',
        flex: 'none',
      }}
    >
      <button
        onClick={onToggleNav}
        style={{
          width: 36,
          height: 36,
          border: '1px solid var(--pi-border)',
          borderRadius: 9,
          background: 'var(--pi-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <MenuIcon size={18} stroke="var(--pi-text)" />
      </button>
      <PiMark tile={26} font={15} radius={7} />
      <span style={{ fontSize: 15, fontWeight: 700 }}>Pi Remote</span>
      <div style={{ flex: 1 }} />
    </div>
  )
}

interface NavDrawerProps {
  sessions: Session[]
  onClose: () => void
  onHome: () => void
  onSettings: () => void
  onOpenSession: (id: string) => void
}

export function MobileNavDrawer({ sessions, onClose, onHome, onSettings, onOpenSession }: NavDrawerProps) {
  const { profile, signOut } = useAuth()
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(27,27,29,.3)', zIndex: 60 }} />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          background: 'var(--pi-sidebar)',
          zIndex: 61,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '16px 0 50px rgba(40,36,28,.18)',
          animation: 'pi-slide .2s ease',
        }}
      >
        <div style={{ padding: '16px 16px 10px' }}>
          <button
            className="pi-hover-fill"
            onClick={onHome}
            style={{ width: '100%', textAlign: 'left', padding: '11px 13px', border: 'none', borderRadius: 10, background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Sessions
          </button>
          <button
            className="pi-hover-fill"
            onClick={onSettings}
            style={{ width: '100%', textAlign: 'left', padding: '11px 13px', border: 'none', borderRadius: 10, background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Settings
          </button>
        </div>
        <div style={{ padding: '6px 16px 8px', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--pi-text-fainter)' }}>
          Active sessions
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
          {sessions.map((n) => {
            const st = statusOf(n.status)
            return (
              <button
                key={n.id}
                className="pi-hover-fill"
                onClick={() => onOpenSession(n.id)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', border: 'none', borderRadius: 9, background: 'transparent', cursor: 'pointer' }}
              >
                <span style={dotStyle(st, false)} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13.5, fontWeight: 500 }}>
                  {n.title}
                </span>
              </button>
            )
          })}
        </div>

        {/* Profile footer — signed-in account + sign-out. */}
        <div style={{ marginTop: 'auto', padding: '12px 14px', borderTop: '1px solid var(--pi-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar url={profile?.avatarUrl ?? null} initials={profile?.initials ?? '··'} size={34} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.name ?? 'Account'}
            </span>
            {profile?.email && (
              <span style={{ fontSize: 12, color: 'var(--pi-text-fainter)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.email}
              </span>
            )}
          </div>
          <button
            className="pi-hover-fill"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            style={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              border: 'none',
              borderRadius: 9,
              background: 'transparent',
              color: 'var(--pi-text-muted)',
              cursor: 'pointer',
            }}
          >
            <LogoutIcon size={17} />
          </button>
          <ThemeToggle />
        </div>
      </aside>
    </>
  )
}
