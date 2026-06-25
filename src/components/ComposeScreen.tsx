import { ArrowRight, BaseBranchIcon, BoltIcon, BranchIcon, ChevronDown, ChevronRight, PiMark } from './icons'

interface ComposeScreenProps {
  composeText: string
  composeRepo: string
  repoMenu: boolean
  skills: Record<string, boolean>
  onComposeText: (v: string) => void
  onToggleRepoMenu: () => void
  onPickRepo: (name: string) => void
  onToggleSkill: (key: string) => void
  onUseExample: (text: string) => void
  onStart: () => void
}

const REPO_OPTIONS = ['acme/web-app', 'acme/payments-api', 'acme/mobile', 'earendil-works/pi']
const SKILL_DEFS: [string, string][] = [
  ['tests', 'Run tests'],
  ['lint', 'Lint & format'],
  ['docs', 'Update docs'],
]
const EXAMPLES = [
  'Add optimistic updates to the cart with rollback on failure',
  'Write integration tests for the webhook handler',
  'Refactor the auth module to use async/await',
]

export function ComposeScreen(props: ComposeScreenProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ display: 'inline-flex', marginBottom: 16 }}>
            <PiMark tile={48} font={27} radius={13} />
          </div>
          <h1 style={{ margin: 0, fontSize: 25, fontWeight: 700, letterSpacing: '-.02em' }}>Start a new session</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--pi-text-muted)', fontSize: 14.5 }}>
            A live Pi instance spins up at remote in a fresh worktree and reports back when it's ready for review.
          </p>
        </div>

        <div style={{ background: 'var(--pi-surface)', border: '1px solid var(--pi-border-card)', borderRadius: 16, padding: 8, boxShadow: '0 4px 20px rgba(40,36,28,.05)' }}>
          <div style={{ display: 'flex', gap: 8, padding: '10px 10px 0', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <button
                className="pi-hover-border"
                onClick={props.onToggleRepoMenu}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', border: '1px solid var(--pi-border)', borderRadius: 10, background: 'var(--pi-surface-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                <BranchIcon size={15} stroke="var(--pi-text-soft)" />
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {props.composeRepo}
                </span>
                <ChevronDown size={13} stroke="var(--pi-text-faint)" />
              </button>
              {props.repoMenu && (
                <div style={{ position: 'absolute', top: 46, left: 0, right: 0, background: 'var(--pi-surface)', border: '1px solid var(--pi-border)', borderRadius: 11, boxShadow: '0 12px 36px rgba(40,36,28,.15)', padding: 5, zIndex: 30 }}>
                  {REPO_OPTIONS.map((name) => (
                    <button
                      key={name}
                      className="pi-hover-soft"
                      onClick={() => props.onPickRepo(name)}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: 'var(--pi-text-body)' }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px', border: '1px solid var(--pi-border)', borderRadius: 10, background: 'var(--pi-surface-muted)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: 'var(--pi-text-muted)' }}>
              <BaseBranchIcon size={14} stroke="var(--pi-text-soft)" />
              base: main
            </div>
          </div>

          <textarea
            value={props.composeText}
            onChange={(e) => props.onComposeText(e.target.value)}
            placeholder={'Describe the task — e.g. “Add optimistic updates to the cart and handle rollback on failure.”'}
            rows={4}
            style={{ width: '100%', border: 'none', resize: 'none', fontSize: 15, lineHeight: 1.6, color: 'var(--pi-text)', background: 'transparent', padding: '14px 12px', minHeight: 96 }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 10px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: 'var(--pi-text-fainter)', marginRight: 2 }}>SKILLS</span>
            {SKILL_DEFS.map(([k, label]) => {
              const on = props.skills[k]
              return (
                <button
                  key={k}
                  onClick={() => props.onToggleSkill(k)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1px solid ${on ? 'var(--pi-green)' : 'var(--pi-border)'}`,
                    background: on ? 'var(--pi-green-soft)' : 'var(--pi-surface)',
                    color: on ? 'var(--pi-green-deep)' : 'var(--pi-text-muted)',
                  }}
                >
                  {label}
                </button>
              )
            })}
            <div style={{ flex: 1 }} />
            <button
              className="pi-hover-ink"
              onClick={props.onStart}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: 'none', borderRadius: 10, background: 'var(--pi-ink-surface)', color: 'var(--pi-on-ink)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
            >
              Start session
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--pi-text-fainter)', marginBottom: 10 }}>
            Try one of these
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EXAMPLES.map((text) => (
              <button
                key={text}
                className="pi-hover-example"
                onClick={() => props.onUseExample(text)}
                style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', border: '1px solid var(--pi-border-card)', borderRadius: 11, background: 'var(--pi-surface)', cursor: 'pointer', fontSize: 14, color: 'var(--pi-text-body)' }}
              >
                <BoltIcon size={16} stroke="var(--pi-amber)" style={{ flex: 'none' }} />
                <span style={{ flex: 1 }}>{text}</span>
                <ChevronRight size={15} stroke="var(--pi-border-hover)" strokeWidth={2} style={{ flex: 'none' }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
