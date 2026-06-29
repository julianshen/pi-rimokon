import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentsCard } from './AgentsCard'

const TOKENS = [
  { jti: 'j1', family_id: 'fam1', label: 'laptop', last_seen_at: '2026-06-29', revoked_at: null },
  { jti: 'j2', family_id: 'fam1', label: 'laptop', last_seen_at: null, revoked_at: null }, // same family
  { jti: 'j3', family_id: 'fam2', label: null, last_seen_at: null, revoked_at: null },
]

function listFetch(tokens = TOKENS) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ tokens }) }) as unknown as Response)
}

describe('AgentsCard', () => {
  it('shows a notice when the server is not configured', () => {
    render(<AgentsCard httpBase="" />) // explicit falsy, independent of env
    expect(screen.getByText(/connect the agent server/i)).toBeInTheDocument()
  })

  it('lists one row per token family', async () => {
    render(<AgentsCard httpBase="https://srv.test" getToken={async () => 'tok'} fetchFn={listFetch()} />)
    await waitFor(() => expect(screen.getByText('laptop')).toBeInTheDocument())
    expect(screen.getByText(/fam2/)).toBeInTheDocument() // unlabeled → family id
    expect(screen.getAllByRole('button', { name: /^revoke$/i })).toHaveLength(2)
  })

  it('revokes a family and disables its button', async () => {
    const user = userEvent.setup()
    const fetchFn = listFetch()
    render(<AgentsCard httpBase="https://srv.test" getToken={async () => 'tok'} fetchFn={fetchFn} />)
    await waitFor(() => expect(screen.getByText('laptop')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /^revoke$/i })[0])
    await waitFor(() =>
      expect(fetchFn).toHaveBeenCalledWith(
        'https://srv.test/agent/tokens/revoke',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    expect(await screen.findAllByRole('button', { name: /revoked/i })).not.toHaveLength(0)
  })

  it('surfaces an error if revoke fails (no optimistic flip)', async () => {
    const user = userEvent.setup()
    // GET list ok; POST revoke fails.
    const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: false, status: 500 } as Response
      return { ok: true, status: 200, json: async () => ({ tokens: TOKENS }) } as unknown as Response
    })
    render(<AgentsCard httpBase="https://srv.test" getToken={async () => 'tok'} fetchFn={fetchFn} />)
    await waitFor(() => expect(screen.getByText('laptop')).toBeInTheDocument())
    await user.click(screen.getAllByRole('button', { name: /^revoke$/i })[0])
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not revoke/i))
    // still revocable (not optimistically marked revoked)
    expect(screen.getAllByRole('button', { name: /^revoke$/i }).length).toBeGreaterThan(0)
  })

  it('shows an empty state when there are no tokens', async () => {
    render(<AgentsCard httpBase="https://srv.test" getToken={async () => 'tok'} fetchFn={listFetch([])} />)
    await waitFor(() => expect(screen.getByText(/no agents authorized/i)).toBeInTheDocument())
  })

  it('surfaces a load error', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 500 }) as Response)
    render(<AgentsCard httpBase="https://srv.test" getToken={async () => 'tok'} fetchFn={fetchFn} />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not load/i))
  })
})
