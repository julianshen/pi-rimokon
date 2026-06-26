import type { ToolView } from '../../lib/sessionView'
import { SpinnerIcon } from '../icons'

export function ToolCard({ tool }: { tool: ToolView }) {
  return (
    <div style={tool.cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px' }}>
        <span style={tool.iconWrapStyle}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <path d={tool.icon} />
          </svg>
        </span>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: 'var(--pi-text-soft)' }}>{tool.verb}</span>
        <span
          style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 12,
            color: 'var(--pi-text-body)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {tool.path}
        </span>
        {tool.running && <SpinnerIcon size={13} />}
        {tool.done && tool.meta && (
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--pi-text-faint)', flex: 'none' }}>{tool.meta}</span>
        )}
      </div>
      {tool.hasDiff && (
        <div style={{ borderTop: '1px solid var(--pi-border-hair)', padding: '7px 0', background: 'var(--pi-surface-muted2)', borderRadius: '0 0 10px 10px', overflowX: 'auto' }}>
          {tool.diff.map((d, i) => (
            <div
              key={i}
              style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 11.5,
                lineHeight: 1.7,
                padding: '0 12px',
                whiteSpace: 'pre',
                background: d.bg,
                color: d.fg,
              }}
            >
              <span style={{ opacity: 0.5, userSelect: 'none' }}>{d.sign} </span>
              {d.code}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
