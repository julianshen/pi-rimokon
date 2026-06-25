import { MODELS } from '../data/models'

interface ModelMenuProps {
  model: string
  onPick: (id: string) => void
}

export function ModelMenu({ model, onPick }: ModelMenuProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 42,
        right: 0,
        width: 248,
        background: 'var(--pi-surface)',
        border: '1px solid var(--pi-border)',
        borderRadius: 12,
        boxShadow: '0 14px 40px rgba(40,36,28,.16)',
        padding: 6,
        zIndex: 40,
        animation: 'pi-rise .14s ease',
      }}
    >
      <div style={{ padding: '7px 10px 4px', fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--pi-text-fainter)' }}>
        Switch model · ⌃L
      </div>
      {MODELS.map((m) => (
        <button
          key={m.id}
          className="pi-hover-soft"
          onClick={() => onPick(m.id)}
          style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', border: 'none', borderRadius: 9, background: 'transparent', cursor: 'pointer' }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: m.id === model ? 'var(--pi-green)' : 'transparent' }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>{m.label}</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: 'var(--pi-text-fainter)' }}>{m.provider}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
