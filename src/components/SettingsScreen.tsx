import type { RepoConnection } from '../lib/types'
import { BranchIcon, LogoutIcon } from './icons'
import { Avatar } from './Avatar'
import { AgentsCard } from './AgentsCard'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from './ThemeToggle'

// Connected repos/agents. In production this list comes from the Pi backend.
const CONNECTED: RepoConnection[] = [
  { name: 'acme/web-app', meta: 'main · last sync 2m ago' },
  { name: 'acme/payments-api', meta: 'main · last sync 5m ago' },
  { name: 'acme/mobile', meta: 'main · last sync 1h ago' },
]

export function SettingsScreen() {
  const { profile, signOut } = useAuth()
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '34px 28px 80px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 25, fontWeight: 700, letterSpacing: '-.02em' }}>Settings</h1>
        <p style={{ margin: '0 0 28px', color: 'var(--pi-text-muted)', fontSize: 14.5 }}>
          Adapt Pi to your workflow — connect repos, manage providers, set defaults.
        </p>

        <div style={{ background: 'var(--pi-surface)', border: '1px solid var(--pi-border-card)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--pi-border-hair)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 650, flex: 1 }}>Account</span>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <Avatar url={profile?.avatarUrl ?? null} initials={profile?.initials ?? '··'} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.name ?? 'Account'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--pi-text-fainter)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.email ?? 'Signed in with GitHub'}
              </div>
            </div>
            <button
              className="pi-hover-border"
              onClick={signOut}
              style={{
                flex: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                border: '1px solid var(--pi-border-strong)',
                borderRadius: 9,
                background: 'var(--pi-surface)',
                color: 'var(--pi-text-body)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'border-color .15s ease',
              }}
            >
              <LogoutIcon size={15} />
              Sign out
            </button>
          </div>
        </div>

        <div style={{ background: 'var(--pi-surface)', border: '1px solid var(--pi-border-card)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--pi-border-hair)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 650, flex: 1 }}>Appearance</span>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 13 }}>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>Theme</span>
            <ThemeToggle />
          </div>
        </div>

        <div style={{ background: 'var(--pi-surface)', border: '1px solid var(--pi-border-card)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--pi-border-hair)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BranchIcon size={17} stroke="var(--pi-text)" strokeWidth={1.9} />
            <span style={{ fontSize: 15, fontWeight: 650, flex: 1 }}>Connected agents</span>
          </div>
          {CONNECTED.map((r) => (
            <div key={r.name} style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--pi-paper)' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--pi-border-hair)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <BranchIcon size={15} stroke="var(--pi-text-soft)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--pi-text-fainter)' }}>{r.meta}</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--pi-green)', fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--pi-green)' }} />
                Connected
              </span>
            </div>
          ))}
        </div>

        <AgentsCard />
      </div>
    </div>
  )
}
