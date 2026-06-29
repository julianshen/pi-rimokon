import { useCallback, useEffect, useState } from 'react'
import { piAccessToken, piHttpBase } from '../lib/piServer'

// Module-level so the default is referentially stable — otherwise a fresh arrow
// each render would churn the load() useCallback + effect into a refetch loop.
const defaultFetch: typeof fetch = (...args) => fetch(...args)

interface TokenRow {
  jti: string
  family_id: string
  label: string | null
  last_seen_at: string | null
  revoked_at: string | null
}

/** One row per token family (the list is newest-first from the server). */
function byFamily(tokens: TokenRow[]): TokenRow[] {
  const seen = new Set<string>()
  return tokens.filter((t) => (seen.has(t.family_id) ? false : (seen.add(t.family_id), true)))
}

/**
 * Settings → Agents (spec §8): list the user's agent tokens and revoke them.
 * Deps are injectable so the card is testable without a live backend. Renders a
 * configuration notice when the server isn't configured.
 */
export function AgentsCard({
  httpBase = piHttpBase,
  getToken = piAccessToken,
  fetchFn = defaultFetch,
}: {
  httpBase?: string
  getToken?: () => Promise<string | null>
  fetchFn?: typeof fetch
} = {}) {
  const [tokens, setTokens] = useState<TokenRow[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!httpBase) return
    setError('') // clear a stale error on retry
    try {
      const token = await getToken()
      if (!token) throw new Error('Sign in to manage agents.')
      const res = await fetchFn(`${httpBase}/agent/tokens`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`Could not load agents (${res.status}).`)
      const body = (await res.json()) as { tokens: TokenRow[] }
      setTokens(body.tokens)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load agents.')
    }
  }, [httpBase, getToken, fetchFn])

  useEffect(() => {
    void load()
  }, [load])

  async function revoke(familyId: string) {
    if (!httpBase) return
    try {
      const token = await getToken()
      if (!token) throw new Error('Sign in to manage agents.')
      const res = await fetchFn(`${httpBase}/agent/tokens/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ family_id: familyId }),
      })
      if (!res.ok) throw new Error(`Could not revoke agent (${res.status}).`)
      setTokens((prev) =>
        (prev ?? []).map((t) => (t.family_id === familyId ? { ...t, revoked_at: new Date().toISOString() } : t)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke agent.')
    }
  }

  const card = (children: React.ReactNode) => (
    <div style={{ background: 'var(--pi-surface)', border: '1px solid var(--pi-border-card)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--pi-border-hair)' }}>
        <span style={{ fontSize: 15, fontWeight: 650 }}>Agent tokens</span>
      </div>
      {children}
    </div>
  )

  if (!httpBase) {
    return card(
      <p style={{ padding: '16px 18px', margin: 0, color: 'var(--pi-text-fainter)', fontSize: 13 }}>
        Connect the agent server to manage device tokens.
      </p>,
    )
  }

  const families = tokens ? byFamily(tokens) : []

  return card(
    <>
      {error && (
        <p role="alert" style={{ padding: '14px 18px', margin: 0, color: 'var(--pi-red, #d33)', fontSize: 13 }}>{error}</p>
      )}
      {tokens && families.length === 0 && !error && (
        <p style={{ padding: '16px 18px', margin: 0, color: 'var(--pi-text-fainter)', fontSize: 13 }}>
          No agents authorized yet. Run <code>pi login</code> to connect one.
        </p>
      )}
      {families.map((t) => {
        const revoked = Boolean(t.revoked_at)
        return (
          <div key={t.family_id} style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--pi-paper)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600 }}>
                {t.label || t.family_id.slice(0, 14)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--pi-text-fainter)' }}>
                {revoked ? 'Revoked' : t.last_seen_at ? `Last seen ${t.last_seen_at}` : 'Never connected'}
              </div>
            </div>
            <button
              className="pi-hover-border"
              onClick={() => revoke(t.family_id)}
              disabled={revoked}
              style={{ flex: 'none', padding: '7px 13px', border: '1px solid var(--pi-border-strong)', borderRadius: 9, background: 'var(--pi-surface)', color: 'var(--pi-text-body)', fontSize: 13, fontWeight: 600, cursor: revoked ? 'default' : 'pointer', opacity: revoked ? 0.5 : 1 }}
            >
              {revoked ? 'Revoked' : 'Revoke'}
            </button>
          </div>
        )
      })}
    </>,
  )
}
