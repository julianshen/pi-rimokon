import type { ThreadItem } from '../../lib/sessionView'
import { PiMark } from '../icons'
import { CheckIcon } from '../icons'
import { ToolCard } from './ToolCard'
import { GenUIBlock } from './GenUIBlock'

interface ThreadProps {
  items: ThreadItem[]
  genuiTheme: 'light' | 'dark'
  onToggleGenuiTheme: () => void
  onPickOption: (option: string) => void
  onReview: () => void
}

export function Thread({ items, genuiTheme, onToggleGenuiTheme, onPickOption, onReview }: ThreadProps) {
  return (
    <div style={{ maxWidth: 756, margin: '0 auto', padding: '26px 22px 30px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {items.map((m, i) =>
        m.kind === 'user' ? (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--pi-avatar-bg)',
                color: 'var(--pi-text-soft)',
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
                marginTop: 1,
              }}
            >
              DV
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>You</span>
                {m.steer && (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 9.5,
                      letterSpacing: '.05em',
                      textTransform: 'uppercase',
                      color: 'var(--pi-amber)',
                      background: 'var(--pi-amber-soft)',
                      padding: '2px 6px',
                      borderRadius: 5,
                    }}
                  >
                    ↵ steered
                  </span>
                )}
              </div>
              <div style={{ background: 'var(--pi-surface)', border: '1px solid var(--pi-border-card)', borderRadius: 12, padding: '11px 14px', fontSize: 14.5, lineHeight: 1.55, color: 'var(--pi-text-body)' }}>
                {m.text}
              </div>
            </div>
          </div>
        ) : (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <PiMark tile={28} font={15} radius={8} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 7 }}>Pi</div>

              {m.intro && <div style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--pi-text-body)', marginBottom: 12 }}>{m.intro}</div>}

              {m.tools.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 13 }}>
                  {m.tools.map((t, ti) => (
                    <ToolCard key={ti} tool={t} />
                  ))}
                </div>
              )}

              {m.genui && <GenUIBlock genui={m.genui} dark={genuiTheme === 'dark'} onToggleTheme={onToggleGenuiTheme} />}

              {m.text && (
                <div style={{ fontSize: 14.5, lineHeight: 1.62, color: 'var(--pi-text-body)' }}>
                  {m.text}
                  {m.cursor && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 16,
                        background: 'var(--pi-green)',
                        marginLeft: 2,
                        verticalAlign: -2,
                        animation: 'pi-blink 1s step-end infinite',
                      }}
                    />
                  )}
                </div>
              )}

              {m.question && (
                <div style={{ marginTop: 13, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {m.options.map((o) => (
                    <button
                      key={o}
                      className="pi-hover-option"
                      onClick={() => onPickOption(o)}
                      style={{ padding: '8px 13px', border: '1px solid var(--pi-scrollbar)', borderRadius: 9, background: 'var(--pi-surface)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--pi-text-body)' }}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}

              {m.reviewCTA && (
                <div
                  style={{
                    marginTop: 15,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '13px 14px',
                    background: 'var(--pi-green-soft)',
                    border: '1px solid var(--pi-green)',
                    borderRadius: 12,
                  }}
                >
                  <CheckIcon size={18} strokeWidth={2} style={{ flex: 'none', color: 'var(--pi-green)' }} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--pi-green-deep)', flex: 1, minWidth: 120 }}>{m.reviewLabel}</span>
                  <button
                    className="pi-hover-green"
                    onClick={onReview}
                    style={{ padding: '8px 14px', border: 'none', borderRadius: 9, background: 'var(--pi-green)', color: 'var(--pi-on-ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Review changes
                  </button>
                </div>
              )}
            </div>
          </div>
        ),
      )}
    </div>
  )
}
