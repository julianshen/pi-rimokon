import type { Session } from '../lib/types'
import { dotStyle, statusOf } from '../lib/theme'
import { MenuIcon, PiMark } from './icons'

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
        borderBottom: '1px solid #e2ded3',
        background: '#efece4',
        flex: 'none',
      }}
    >
      <button
        onClick={onToggleNav}
        style={{
          width: 36,
          height: 36,
          border: '1px solid #e2ded3',
          borderRadius: 9,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <MenuIcon size={18} stroke="#1b1b1d" />
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
          background: '#efece4',
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
        <div style={{ padding: '6px 16px 8px', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9b9788' }}>
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
      </aside>
    </>
  )
}
