import type { Session } from '../lib/types'
import { fileBadgeColors } from '../lib/theme'
import { numberDiff } from '../lib/sessionView'
import type { RightTab } from '../hooks/useAppStore'
import { CloseIcon } from './icons'

interface WorkPanelProps {
  session: Session
  tab: RightTab
  diffIndex: number
  onTab: (tab: RightTab) => void
  onSelectDiff: (index: number) => void
  onClose: () => void
}

function badgeStyle(status: string): React.CSSProperties {
  const { c, bg } = fileBadgeColors(status)
  return {
    width: 18,
    height: 18,
    flex: 'none',
    borderRadius: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: 10,
    fontWeight: 700,
    color: c,
    background: bg,
  }
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 13px',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 600,
    background: active ? 'var(--pi-ink-surface)' : 'transparent',
    color: active ? 'var(--pi-on-ink)' : 'var(--pi-text-muted)',
  }
}

function terminalColor(line: string): string {
  if (line && line.startsWith('$')) return '#9fe3bd'
  if (line && (line.includes('ERR') || line.includes('failed'))) return 'var(--pi-red-border)'
  if (line && line.includes('✓')) return '#9fe3bd'
  return 'var(--pi-border-strong)'
}

export function WorkPanel({ session, tab, diffIndex, onTab, onSelectDiff, onClose }: WorkPanelProps) {
  const changes = session.changes || []
  const activeChange = changes[diffIndex] || changes[0]
  const activeDiff = activeChange ? numberDiff(activeChange.diff || []) : []
  const terminal = session.terminal || []

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(27,27,29,.18)', zIndex: 50 }} />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(460px, 94vw)',
          background: 'var(--pi-surface)',
          borderLeft: '1px solid var(--pi-border)',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-16px 0 50px rgba(var(--pi-shadow-rgb),.14)',
          animation: 'pi-slide .22s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '12px 14px', borderBottom: '1px solid var(--pi-border-card)' }}>
          {(['files', 'diff', 'terminal'] as RightTab[]).map((k) => (
            <button key={k} onClick={() => onTab(k)} style={tabStyle(tab === k)}>
              {k === 'files' ? 'Files' : k === 'diff' ? 'Diff' : 'Terminal'}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            className="pi-hover-soft2"
            onClick={onClose}
            style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: 'var(--pi-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <CloseIcon size={16} stroke="var(--pi-text-soft)" />
          </button>
        </div>

        {tab === 'files' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
            {changes.map((c, i) => (
              <button
                key={c.path}
                className="pi-hover-soft"
                onClick={() => onSelectDiff(i)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 11px', border: 'none', borderRadius: 9, background: 'transparent', cursor: 'pointer' }}
              >
                <span style={badgeStyle(c.status)}>{c.status}</span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.path}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--pi-green)' }}>+{c.add}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--pi-red-deep)' }}>−{c.del}</span>
              </button>
            ))}
            {changes.length === 0 && <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--pi-text-fainter)', fontSize: 13 }}>No file changes yet.</div>}
          </div>
        )}

        {tab === 'diff' && (
          <div style={{ flex: 1, overflow: 'auto', background: 'var(--pi-surface-muted2)' }}>
            <div style={{ position: 'sticky', top: 0, background: 'var(--pi-surface-muted2)', borderBottom: '1px solid var(--pi-border-card)', padding: '10px 14px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600 }}>
              {activeChange ? activeChange.path : ''}
            </div>
            {activeDiff.map((d, i) => (
              <div key={i} style={{ display: 'flex', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, lineHeight: 1.8, background: d.bg }}>
                <span style={{ width: 40, flex: 'none', textAlign: 'right', paddingRight: 10, color: 'var(--pi-border-hover)', userSelect: 'none' }}>{d.ln}</span>
                <span style={{ flex: 1, whiteSpace: 'pre', paddingRight: 14, color: d.fg }}>
                  <span style={{ opacity: 0.5 }}>{d.sign} </span>
                  {d.code}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === 'terminal' && (
          <div style={{ flex: 1, overflow: 'auto', background: '#1b1b1d', padding: '14px 16px' }}>
            {terminal.map((line, i) => (
              <div key={i} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, lineHeight: 1.75, color: terminalColor(line), whiteSpace: 'pre-wrap' }}>
                {line || ' '}
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  )
}
