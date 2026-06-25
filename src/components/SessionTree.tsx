import type { Session } from '../lib/types'
import { BookmarkIcon, CloseIcon, RewindIcon, ShareIcon, TreeIcon } from './icons'

interface SessionTreeProps {
  session: Session
  onClose: () => void
  onRewind: () => void
}

export function SessionTree({ session, onClose, onRewind }: SessionTreeProps) {
  const nodes = session.tree || []

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(27,27,29,.18)', zIndex: 50 }} />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(420px, 94vw)',
          background: '#faf8f2',
          borderLeft: '1px solid #e2ded3',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-16px 0 50px rgba(40,36,28,.14)',
          animation: 'pi-slide .22s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #e6e2d6' }}>
          <TreeIcon size={17} stroke="#1b1b1d" />
          <span style={{ fontSize: 15, fontWeight: 650, flex: 1 }}>Session tree</span>
          <button
            className="pi-hover-border"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: '1px solid #e2ded3', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace" }}
          >
            <ShareIcon size={13} />
            /share
          </button>
          <button
            className="pi-hover-fill"
            onClick={onClose}
            style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: '#f0ede4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <CloseIcon size={16} stroke="#5c594f" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {nodes.map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: 18, paddingLeft: n.branch ? 16 : 0 }}>
                <span
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    flex: 'none',
                    marginTop: 4,
                    background: n.current ? '#1f8a5b' : n.branch ? '#fff' : '#cdc8ba',
                    border: `2px solid ${n.current ? '#1f8a5b' : n.branch ? '#cdc8ba' : 'transparent'}`,
                    boxShadow: n.current ? '0 0 0 3px #e6f2eb' : 'none',
                  }}
                />
                {i < nodes.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 26, background: '#dcd7ca' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: n.current ? '#1f8a5b' : '#33312c' }}>{n.label}</span>
                  {n.bookmark && <BookmarkIcon size={13} />}
                  {n.current && (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 9,
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        color: '#1f8a5b',
                        background: '#e6f2eb',
                        padding: '2px 6px',
                        borderRadius: 5,
                      }}
                    >
                      current
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#9b9788', marginTop: 2 }}>{n.meta}</div>
                {n.canRewind && (
                  <button
                    className="pi-hover-rewind"
                    onClick={onRewind}
                    style={{ marginTop: 7, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 9px', border: '1px solid #e2ded3', borderRadius: 7, background: '#fff', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', color: '#5c594f' }}
                  >
                    <RewindIcon size={12} />
                    Rewind &amp; branch here
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}
