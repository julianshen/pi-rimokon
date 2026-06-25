import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewScreen } from './ReviewScreen'
import { MockPiService } from '../services/MockPiService'
import type { Session } from '../lib/types'

// Pick a seeded session that actually has multiple file changes + diffs so the
// changed-files list and the diff pane both render real content.
function sessionWithChanges(): Session {
  const sess = new MockPiService().listSessions().find((s) => (s.changes?.length ?? 0) >= 2)
  if (!sess) throw new Error('expected a seeded session with at least two file changes')
  return sess
}

describe('ReviewScreen', () => {
  it('renders the header, branch summary and the changed files list', () => {
    const session = sessionWithChanges()
    render(<ReviewScreen session={session} diffIndex={0} onSelectDiff={vi.fn()} onBack={vi.fn()} />)

    expect(screen.getByText(session.title)).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`${session.changes.length} files`)),
    ).toBeInTheDocument()
    // Every changed file path appears (in the sidebar list).
    for (const c of session.changes) {
      expect(screen.getAllByText(c.path).length).toBeGreaterThan(0)
    }
    expect(screen.getByRole('button', { name: /approve & merge/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /request changes/i })).toBeInTheDocument()
  })

  it('shows the diff for the file at diffIndex 0', () => {
    const session = sessionWithChanges()
    render(<ReviewScreen session={session} diffIndex={0} onSelectDiff={vi.fn()} onBack={vi.fn()} />)
    // Diff body of the first change (rateLimit.ts).
    expect(screen.getByText(/interface RateLimitOpts/)).toBeInTheDocument()
  })

  it('shows a different diff when diffIndex changes', () => {
    const session = sessionWithChanges()
    render(<ReviewScreen session={session} diffIndex={1} onSelectDiff={vi.fn()} onBack={vi.fn()} />)
    // Diff body unique to the second change (login.ts).
    expect(screen.getByText(/const router = Router\(\)/)).toBeInTheDocument()
    // The first file's unique diff body is no longer shown.
    expect(screen.queryByText(/interface RateLimitOpts/)).not.toBeInTheDocument()
  })

  it('fires onSelectDiff with the clicked file index', async () => {
    const user = userEvent.setup()
    const onSelectDiff = vi.fn()
    const session = sessionWithChanges()
    render(<ReviewScreen session={session} diffIndex={0} onSelectDiff={onSelectDiff} onBack={vi.fn()} />)

    // The changed-files sidebar rows are buttons containing each path.
    const secondPath = session.changes[1].path
    const row = screen.getByText(secondPath).closest('button')
    expect(row).not.toBeNull()
    await user.click(row!)
    expect(onSelectDiff).toHaveBeenCalledWith(1)
  })

  it('fires onBack when the Session button is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const session = sessionWithChanges()
    render(<ReviewScreen session={session} diffIndex={0} onSelectDiff={vi.fn()} onBack={onBack} />)

    await user.click(screen.getByRole('button', { name: /session/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('falls back to the first change when diffIndex is out of range', () => {
    const session = sessionWithChanges()
    render(<ReviewScreen session={session} diffIndex={99} onSelectDiff={vi.fn()} onBack={vi.fn()} />)
    // activeChange = changes[0] → first file's diff body is shown.
    const headers = screen.getAllByText(session.changes[0].path)
    expect(headers.length).toBeGreaterThan(0)
    expect(screen.getByText(/interface RateLimitOpts/)).toBeInTheDocument()
  })

  it('renders an empty changed-files list without crashing for a session with no changes', () => {
    const session = new MockPiService().listSessions().find((s) => (s.changes?.length ?? 0) === 0)
    if (!session) throw new Error('expected a seeded session with no changes')
    const { container } = render(
      <ReviewScreen session={session} diffIndex={0} onSelectDiff={vi.fn()} onBack={vi.fn()} />,
    )
    expect(within(container).getByText('Changed files')).toBeInTheDocument()
    expect(screen.getByText(session.title)).toBeInTheDocument()
  })
})
