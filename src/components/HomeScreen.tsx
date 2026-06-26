import type { Session } from '../lib/types'
import { STATUS, dotStyle, pillStyle, statusOf, type StatusKey } from '../lib/theme'
import { modelLabel } from '../data/models'
import { BranchIcon, ClockIcon } from './icons'

interface HomeScreenProps {
  sessions: Session[]
  filter: string
  onFilter: (key: string) => void
  onOpenSession: (id: string) => void
}

const FILTER_DEFS: [string, string][] = [
  ['all', 'All'],
  ['working', 'Working'],
  ['review', 'Needs review'],
  ['waiting', 'Waiting'],
  ['done', 'Done'],
]

export function HomeScreen({ sessions, filter, onFilter, onOpenSession }: HomeScreenProps) {
  const counts: Record<string, number> = { all: sessions.length }
  ;(Object.keys(STATUS) as StatusKey[]).forEach((k) => {
    counts[k] = sessions.filter((x) => x.status === k).length
  })

  const cards = sessions.filter((x) => filter === 'all' || x.status === filter)

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '34px 32px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ margin: 0, fontSize: 27, fontWeight: 700, letterSpacing: '-.02em' }}>Sessions</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--pi-text-muted)', fontSize: 14.5 }}>
              {counts.working || 0} working · {counts.review || 0} need review · {counts.waiting || 0} waiting on you
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, margin: '22px 0 20px', flexWrap: 'wrap' }}>
          {FILTER_DEFS.map(([k, label]) => {
            const active = filter === k
            return (
              <button
                key={k}
                className="pi-hover-border"
                onClick={() => onFilter(k)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '7px 13px',
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--pi-ink-surface)' : 'var(--pi-border)'}`,
                  background: active ? 'var(--pi-ink-surface)' : 'var(--pi-surface)',
                  color: active ? 'var(--pi-on-ink)' : 'var(--pi-text-soft)',
                }}
              >
                {label}
                <span style={{ opacity: 0.55, marginLeft: 6, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                  {counts[k] || 0}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
          {cards.map((c) => {
            const st = statusOf(c.status)
            const hasChanges = c.add + c.del > 0
            return (
              <button
                key={c.id}
                className="pi-hover-card"
                onClick={() => onOpenSession(c.id)}
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: 'var(--pi-surface)',
                  border: '1px solid var(--pi-border-card)',
                  borderRadius: 14,
                  padding: '16px 16px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={pillStyle(st)}>
                    <span style={dotStyle(st, false)} />
                    {st.label}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--pi-text-fainter)' }}>{c.time}</span>
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 650, lineHeight: 1.3, letterSpacing: '-.01em' }}>{c.title}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: 'var(--pi-text-muted)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <BranchIcon size={13} style={{ flex: 'none' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.repo} · {c.branch}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--pi-text-soft)', fontSize: 13, borderTop: '1px solid var(--pi-border-hair)', paddingTop: 11 }}>
                  <span style={dotStyle(st, false)} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.latest}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--pi-text-faint)' }}>
                    <ClockIcon size={12} />
                    {modelLabel(c.model)}
                  </span>
                  <div style={{ flex: 1 }} />
                  {hasChanges && (
                    <>
                      <span style={{ color: 'var(--pi-green)' }}>+{c.add}</span>
                      <span style={{ color: 'var(--pi-red-deep)', marginLeft: -6 }}>−{c.del}</span>
                    </>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
