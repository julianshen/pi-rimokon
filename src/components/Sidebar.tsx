import type { Session } from '../lib/types'
import { dotStyle, statusOf } from '../lib/theme'
import { GearIcon, GridIcon, LogoutIcon, PiMark } from './icons'
import { Avatar } from './Avatar'
import { useAuth } from '../hooks/useAuth'
import type { Route } from '../hooks/useAppStore'

interface SidebarProps {
  route: Route
  sessions: Session[]
  activeId: string
  onHome: () => void
  onSettings: () => void
  onOpenSession: (id: string) => void
}

function navStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    border: 'none',
    borderRadius: 9,
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: 600,
    color: '#33312c',
    background: active ? '#e6e2d6' : 'transparent',
  }
}

export function Sidebar({ route, sessions, activeId, onHome, onSettings, onOpenSession }: SidebarProps) {
  const { profile, signOut } = useAuth()
  return (
    <aside
      style={{
        width: 268,
        flex: 'none',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#efece4',
        borderRight: '1px solid #e2ded3',
      }}
    >
      <div style={{ padding: '18px 18px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <PiMark tile={30} font={18} radius={8} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>Pi Remote</span>
        </div>
      </div>

      <div style={{ height: 6 }} />

      <nav style={{ padding: '2px 10px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <button className="pi-hover-row" onClick={onHome} style={navStyle(route === 'home')}>
          <GridIcon size={16} />
          Sessions
        </button>
        <button className="pi-hover-row" onClick={onSettings} style={navStyle(route === 'settings')}>
          <GearIcon size={16} />
          Settings
        </button>
      </nav>

      <div
        style={{
          padding: '14px 18px 6px',
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 10,
          letterSpacing: '.08em',
          color: '#9b9788',
          textTransform: 'uppercase',
        }}
      >
        Active sessions
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {sessions.map((n) => {
          const st = statusOf(n.status)
          const selected = n.id === activeId && route === 'session'
          return (
            <button
              key={n.id}
              className="pi-hover-row"
              onClick={() => onOpenSession(n.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 11px',
                border: 'none',
                borderRadius: 9,
                cursor: 'pointer',
                background: selected ? '#e6e2d6' : 'transparent',
              }}
            >
              <span style={{ position: 'relative', width: 8, height: 8, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={dotStyle(st, false)} />
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500 }}>
                {n.title}
              </span>
            </button>
          )
        })}
      </div>

      {/* Profile footer — the signed-in Google account, with sign-out. */}
      <div style={{ marginTop: 'auto', padding: '12px 14px', borderTop: '1px solid #e2ded3', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar url={profile?.avatarUrl ?? null} initials={profile?.initials ?? '··'} size={32} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile?.name ?? 'Account'}
          </span>
          {profile?.email && (
            <span style={{ fontSize: 11.5, color: '#9b9788', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.email}
            </span>
          )}
        </div>
        <button
          className="pi-hover-row"
          onClick={signOut}
          title="Sign out"
          aria-label="Sign out"
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            border: 'none',
            borderRadius: 8,
            background: 'transparent',
            color: '#9b9788',
            cursor: 'pointer',
          }}
        >
          <LogoutIcon size={16} />
        </button>
      </div>
    </aside>
  )
}
