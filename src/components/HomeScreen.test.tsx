import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HomeScreen } from './HomeScreen'
import { MockPiService } from '../services/MockPiService'
import type { Session } from '../lib/types'

const sessions = new MockPiService().listSessions()

function renderHome(overrides: Partial<React.ComponentProps<typeof HomeScreen>> = {}) {
  const props = {
    sessions,
    filter: 'all',
    onFilter: vi.fn(),
    onOpenSession: vi.fn(),
    ...overrides,
  }
  render(<HomeScreen {...props} />)
  return props
}

describe('HomeScreen', () => {
  it('renders the heading and a summary count line', () => {
    renderHome()
    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument()
    // 2 working, 1 review, 1 waiting in the seed data.
    expect(
      screen.getByText(/2 working · 1 need review · 1 waiting on you/),
    ).toBeInTheDocument()
  })

  it('renders the full filter bar with per-status counts', () => {
    renderHome()
    // Filter chips render their label immediately followed by a count, with no
    // intervening text (cards embed the same labels, so anchor to disambiguate).
    expect(screen.getByRole('button', { name: /^All6$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Working2$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Needs review1$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Waiting1$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Done1$/ })).toBeInTheDocument()
  })

  it('shows every session card when filter is "all"', () => {
    renderHome({ filter: 'all' })
    expect(screen.getByText('Add rate limiting to login endpoint')).toBeInTheDocument()
    expect(screen.getByText('Fix flaky checkout E2E test')).toBeInTheDocument()
    expect(screen.getByText('Bump dependencies to latest')).toBeInTheDocument()
  })

  it('filters cards to a single status (working)', () => {
    renderHome({ filter: 'working' })
    // Both working sessions render...
    expect(screen.getByText('Add rate limiting to login endpoint')).toBeInTheDocument()
    expect(screen.getByText('Migrate logging to structured JSON')).toBeInTheDocument()
    // ...but ones in other statuses do not.
    expect(screen.queryByText('Fix flaky checkout E2E test')).not.toBeInTheDocument()
    expect(screen.queryByText('Add dark mode toggle to settings')).not.toBeInTheDocument()
  })

  it('filters cards to the "done" status', () => {
    renderHome({ filter: 'done' })
    expect(screen.getByText('Add dark mode toggle to settings')).toBeInTheDocument()
    expect(screen.queryByText('Add rate limiting to login endpoint')).not.toBeInTheDocument()
  })

  it('renders no cards when the session list is empty', () => {
    renderHome({ sessions: [], filter: 'all' })
    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument()
    expect(screen.getByText(/0 working · 0 need review · 0 waiting on you/)).toBeInTheDocument()
    // No card titles from the seed data are present.
    expect(screen.queryByText('Add rate limiting to login endpoint')).not.toBeInTheDocument()
    // The "All" filter count is zero.
    expect(screen.getByRole('button', { name: /^All0$/ })).toBeInTheDocument()
  })

  it('renders cards even for a status missing from the filter bar (error)', () => {
    // "error" has no filter chip, but the card grid still filters by it.
    renderHome({ filter: 'error' })
    expect(screen.getByText('Bump dependencies to latest')).toBeInTheDocument()
    expect(screen.queryByText('Add rate limiting to login endpoint')).not.toBeInTheDocument()
  })

  it('shows the +adds / −dels footer when a card has changes', () => {
    // s2 (review) has add/del > 0; assert its numbers show within its card.
    renderHome({ filter: 'review' })
    const card = screen.getByText('Fix flaky checkout E2E test').closest('button')!
    const reviewSession = sessions.find((s: Session) => s.id === 's2')!
    expect(within(card).getByText(`+${reviewSession.add}`)).toBeInTheDocument()
    expect(within(card).getByText(`−${reviewSession.del}`)).toBeInTheDocument()
  })

  it('omits the +adds / −dels footer when a card has no changes', () => {
    // s4 (done) has add=0, del=0 -> no diff footer numbers.
    renderHome({ filter: 'done' })
    const card = screen.getByText('Add dark mode toggle to settings').closest('button')!
    expect(within(card).queryByText('+0')).not.toBeInTheDocument()
    expect(within(card).queryByText('−0')).not.toBeInTheDocument()
  })

  it('fires onFilter with the chip key when a filter is clicked', async () => {
    const user = userEvent.setup()
    const props = renderHome()
    // Anchor to the chip ("Needs review1"), not the s2 card pill.
    await user.click(screen.getByRole('button', { name: /^Needs review1$/ }))
    expect(props.onFilter).toHaveBeenCalledWith('review')
  })

  it('fires onOpenSession with the session id when a card is clicked', async () => {
    const user = userEvent.setup()
    const props = renderHome()
    await user.click(screen.getByText('Add rate limiting to login endpoint'))
    expect(props.onOpenSession).toHaveBeenCalledWith('s1')
  })
})
