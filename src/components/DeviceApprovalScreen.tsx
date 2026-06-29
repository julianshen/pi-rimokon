import { useState } from 'react'
import { piAccessToken, piHttpBase } from '../lib/piServer'

type Phase = 'idle' | 'working' | 'approved' | 'denied' | 'error'

function readCodeFromUrl(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('code') ?? ''
}

/**
 * `/device` approval page (spec §3.1): a signed-in user authorizes an agent's
 * device code. Reads `?code=` from the verification URL, confirms with the
 * user, and POSTs the decision to the server with the Supabase JWT.
 * Dependencies are injectable so the page is testable without a live backend.
 */
export function DeviceApprovalScreen({
  httpBase = piHttpBase,
  getToken = piAccessToken,
  fetchFn = (...args: Parameters<typeof fetch>) => fetch(...args),
}: {
  httpBase?: string
  getToken?: () => Promise<string | null>
  fetchFn?: typeof fetch
} = {}) {
  const [code, setCode] = useState(readCodeFromUrl)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')

  async function submit(decision: 'approve' | 'deny') {
    if (!httpBase || !code.trim()) return
    setPhase('working')
    setError('')
    try {
      const token = await getToken()
      if (!token) throw new Error('Please sign in first.')
      const res = await fetchFn(`${httpBase}/oauth/device/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_code: code.trim(), decision }),
      })
      if (!res.ok) throw new Error(`Could not ${decision} this code (${res.status}).`)
      setPhase(decision === 'approve' ? 'approved' : 'denied')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPhase('error')
    }
  }

  const done = phase === 'approved' || phase === 'denied'
  const busy = phase === 'working'

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--pi-paper)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--pi-surface)', border: '1px solid var(--pi-border-card)', borderRadius: 16, padding: '28px 26px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 700, letterSpacing: '-.02em' }}>Authorize agent</h1>
        <p style={{ margin: '0 0 22px', color: 'var(--pi-text-muted)', fontSize: 14 }}>
          A Pi agent wants to connect to your account. Confirm the code it’s showing.
        </p>

        {!httpBase ? (
          <p role="alert" style={{ color: 'var(--pi-text-muted)', fontSize: 14 }}>
            The agent server isn’t configured for this deployment.
          </p>
        ) : done ? (
          <p role="status" style={{ fontSize: 15, fontWeight: 600, color: phase === 'approved' ? 'var(--pi-green)' : 'var(--pi-text-body)' }}>
            {phase === 'approved' ? 'Agent authorized — you can return to your terminal.' : 'Request denied.'}
          </p>
        ) : (
          <>
            <label htmlFor="user-code" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 7 }}>
              Device code
            </label>
            <input
              id="user-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WDJB-MJHT"
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', fontFamily: "'JetBrains Mono',monospace", fontSize: 16, letterSpacing: '.06em', border: '1px solid var(--pi-border-strong)', borderRadius: 10, background: 'var(--pi-paper)', color: 'var(--pi-text-body)', marginBottom: 18 }}
            />
            {error && (
              <p role="alert" style={{ color: 'var(--pi-red, #d33)', fontSize: 13, margin: '0 0 14px' }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => submit('approve')}
                disabled={busy || !code.trim()}
                style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 10, background: 'var(--pi-text)', color: 'var(--pi-paper)', fontSize: 14, fontWeight: 650, cursor: busy ? 'default' : 'pointer', opacity: busy || !code.trim() ? 0.6 : 1 }}
              >
                {busy ? 'Authorizing…' : 'Authorize'}
              </button>
              <button
                onClick={() => submit('deny')}
                disabled={busy || !code.trim()}
                className="pi-hover-border"
                style={{ flex: 'none', padding: '11px 16px', border: '1px solid var(--pi-border-strong)', borderRadius: 10, background: 'var(--pi-surface)', color: 'var(--pi-text-body)', fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer' }}
              >
                Deny
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
