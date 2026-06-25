import type { GenUI } from '../../lib/types'
import { buildGenUI } from '../../lib/sessionView'
import { ChevronRight, SparkleIcon } from '../icons'

interface GenUIBlockProps {
  genui: GenUI
  dark: boolean
  onToggleTheme: () => void
}

// Inline rich widget rendered by Pi at remote — either a live interactive
// preview or a data chart. Mirrors the prototype's generative-UI block.
export function GenUIBlock({ genui, dark, onToggleTheme }: GenUIBlockProps) {
  const view = buildGenUI(genui, dark)
  if (!view) return null

  return (
    <div style={{ margin: '2px 0 14px', border: '1px solid #e2ded3', borderRadius: 13, overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderBottom: '1px solid #f0ede4', background: '#faf8f2' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 9.5,
            letterSpacing: '.07em',
            textTransform: 'uppercase',
            color: '#7a5bd6',
            fontWeight: 600,
          }}
        >
          <SparkleIcon size={13} />
          Generative UI
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: '#33312c' }}>{view.title}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: '#9b9788' }}>{view.tag}</span>
      </div>

      {view.type === 'chart' && (
        <div style={{ padding: '16px 16px 13px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, borderBottom: '1px solid #ece9e1', paddingBottom: 6 }}>
            {view.bars.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, fontWeight: 600, color: b.valColor }}>{b.val}</span>
                <div style={{ width: '100%', height: 104, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={b.barStyle} />
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#9b9788' }}>{b.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: '#c0432f', flex: 'none' }} />
            <span style={{ fontSize: 12, color: '#76736b' }}>{view.note}</span>
          </div>
        </div>
      )}

      {view.type === 'preview' && (
        <div style={{ padding: 16 }}>
          <div style={view.paneStyle}>
            <div style={view.headingStyle}>Settings</div>
            <div style={view.sectionLabelStyle}>Appearance</div>
            <div style={view.rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Dark mode</div>
                <div style={view.subStyle}>Match system preference on first load</div>
              </div>
              <button onClick={onToggleTheme} style={view.trackStyle}>
                <span style={view.knobStyle} />
              </button>
            </div>
            <div style={view.row2Style}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Reduce motion</div>
                <div style={view.subStyle}>Disable non-essential animations</div>
              </div>
              <div style={view.trackOffStyle}>
                <span style={view.knobOffStyle} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
            <ChevronRight size={13} stroke="#9b9788" strokeWidth={2} style={{ flex: 'none' }} />
            <span style={{ fontSize: 11.5, color: '#9b9788' }}>Interactive — rendered live by Pi at remote. Toggle to try it.</span>
          </div>
        </div>
      )}
    </div>
  )
}
