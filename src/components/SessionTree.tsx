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
          background: 'var(--pi-surface-muted)',
          borderLeft: '1px solid var(--pi-border)',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-16px 0 50px rgba(var(--pi-shadow-rgb),.14)',
          animation: 'pi-slide .22s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--pi-border-card)' }}>
          <TreeIcon size={17} stroke="var(--pi-text)" />
          <span style={{ fontSize: 15, fontWeight: 650, flex: 1 }}>Session tree</span>
          <button
            className="pi-hover-border"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: '1px solid var(--pi-border)', borderRadius: 8, background: 'var(--pi-surface)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace" }}
          >
            <ShareIcon size={13} />
            /share
          </button>
          <button
            className="pi-hover-fill"
            onClick={onClose}
            aria-label="Close session tree"
            style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: 'var(--pi-border-hair)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <CloseIcon size={16} stroke="var(--pi-text-soft)" />
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
                    background: n.current ? 'var(--pi-green)' : n.branch ? 'var(--pi-surface)' : 'var(--pi-avatar-bg)',
                    border: `2px solid ${n.current ? 'var(--pi-green)' : n.branch ? 'var(--pi-avatar-bg)' : 'transparent'}`,
                    boxShadow: n.current ? '0 0 0 3px var(--pi-green-soft)' : 'none',
                  }}
                />
                {i < nodes.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 26, background: 'var(--pi-border-strong)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: n.current ? 'var(--pi-green)' : 'var(--pi-text-body)' }}>{n.label}</span>
                  {n.bookmark && <BookmarkIcon size={13} />}
                  {n.current && (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 9,
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        color: 'var(--pi-green)',
                        background: 'var(--pi-green-soft)',
                        padding: '2px 6px',
                        borderRadius: 5,
                      }}
                    >
                      current
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--pi-text-fainter)', marginTop: 2 }}>{n.meta}</div>
                {n.canRewind && (
                  <button
                    className="pi-hover-rewind"
                    onClick={onRewind}
                    style={{ marginTop: 7, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 9px', border: '1px solid var(--pi-border)', borderRadius: 7, background: 'var(--pi-surface)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', color: 'var(--pi-text-soft)' }}
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
