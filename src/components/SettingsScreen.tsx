import type { RepoConnection } from '../lib/types'
import { BranchIcon } from './icons'

// Connected repos/agents. In production this list comes from the Pi backend.
const CONNECTED: RepoConnection[] = [
  { name: 'acme/web-app', meta: 'main · last sync 2m ago' },
  { name: 'acme/payments-api', meta: 'main · last sync 5m ago' },
  { name: 'acme/mobile', meta: 'main · last sync 1h ago' },
]

export function SettingsScreen() {
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '34px 28px 80px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 25, fontWeight: 700, letterSpacing: '-.02em' }}>Settings</h1>
        <p style={{ margin: '0 0 28px', color: '#76736b', fontSize: 14.5 }}>
          Adapt Pi to your workflow — connect repos, manage providers, set defaults.
        </p>

        <div style={{ background: '#fff', border: '1px solid #e6e2d6', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '15px 18px', borderBottom: '1px solid #f0ede4', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BranchIcon size={17} stroke="#1b1b1d" strokeWidth={1.9} />
            <span style={{ fontSize: 15, fontWeight: 650, flex: 1 }}>Connected agents</span>
          </div>
          {CONNECTED.map((r) => (
            <div key={r.name} style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f4f2ec' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f0ede4', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <BranchIcon size={15} stroke="#5c594f" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: '#9b9788' }}>{r.meta}</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#1f8a5b', fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f8a5b' }} />
                Connected
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
