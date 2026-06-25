import type { Session } from '../lib/types'
import { fileBadgeColors } from '../lib/theme'
import { numberDiff } from '../lib/sessionView'
import { CheckIcon, ChevronLeft } from './icons'

interface ReviewScreenProps {
  session: Session
  diffIndex: number
  onSelectDiff: (index: number) => void
  onBack: () => void
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

export function ReviewScreen({ session, diffIndex, onSelectDiff, onBack }: ReviewScreenProps) {
  const changes = session.changes || []
  const activeChange = changes[diffIndex] || changes[0]
  const activeDiff = activeChange ? numberDiff(activeChange.diff || []) : []
  const reviewSummary = `${changes.length} files · +${session.add} −${session.del}`

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: '1px solid #e6e2d6' }}>
        <button
          className="pi-hover-border"
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', border: '1px solid #e2ded3', borderRadius: 9, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          <ChevronLeft size={15} stroke="#5c594f" />
          Session
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.title}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#8a8678', marginTop: 2 }}>
            {session.branch} → main · {reviewSummary}
          </div>
        </div>
        <button
          className="pi-hover-reject"
          style={{ padding: '8px 13px', border: '1px solid #e2ded3', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#b23a28' }}
        >
          Request changes
        </button>
        <button
          className="pi-hover-green"
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', border: 'none', borderRadius: 9, background: '#1f8a5b', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <CheckIcon size={15} />
          Approve &amp; merge
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: 280, flex: 'none', borderRight: '1px solid #e6e2d6', overflowY: 'auto', padding: '14px 10px', background: '#faf8f2' }}>
          <div style={{ padding: '4px 10px 10px', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9b9788' }}>
            Changed files
          </div>
          {changes.map((c, i) => (
            <button
              key={c.path}
              className="pi-hover-soft2-row"
              onClick={() => onSelectDiff(i)}
              style={{
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 10px',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                background: i === diffIndex ? '#fff' : 'transparent',
                boxShadow: i === diffIndex ? '0 1px 3px rgba(40,36,28,.08)' : 'none',
              }}
            >
              <span style={badgeStyle(c.status)}>{c.status}</span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  direction: 'rtl',
                  textAlign: 'left',
                }}
              >
                {c.path}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: '#1f8a5b', flex: 'none' }}>+{c.add}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: '#b23a28', flex: 'none' }}>−{c.del}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: '#fff' }}>
          <div
            style={{
              position: 'sticky',
              top: 0,
              background: '#fbfaf6',
              borderBottom: '1px solid #e6e2d6',
              padding: '11px 18px',
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: 12.5,
              fontWeight: 600,
              color: '#33312c',
            }}
          >
            {activeChange ? activeChange.path : ''}
          </div>
          <div style={{ padding: '6px 0 40px' }}>
            {activeDiff.map((d, i) => (
              <div key={i} style={{ display: 'flex', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, lineHeight: 1.85, background: d.bg }}>
                <span style={{ width: 46, flex: 'none', textAlign: 'right', paddingRight: 12, color: '#bdb9ac', userSelect: 'none' }}>{d.ln}</span>
                <span style={{ flex: 1, whiteSpace: 'pre', paddingRight: 18, color: d.fg }}>
                  <span style={{ opacity: 0.55, userSelect: 'none' }}>{d.sign} </span>
                  {d.code}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
