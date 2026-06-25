import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkPanel } from './WorkPanel'
import { MockPiService } from '../services/MockPiService'
import type { Session } from '../lib/types'
import type { RightTab } from '../hooks/useAppStore'

// A seeded session with file changes, diffs and terminal output exercises every
// tab of the panel.
function richSession(): Session {
  const sess = new MockPiService()
    .listSessions()
    .find((s) => (s.changes?.length ?? 0) >= 2 && (s.terminal?.length ?? 0) > 0)
  if (!sess) throw new Error('expected a seeded session with changes and terminal output')
  return sess
}

function renderPanel(tab: RightTab, overrides: Partial<Parameters<typeof WorkPanel>[0]> = {}) {
  const props = {
    session: richSession(),
    tab,
    diffIndex: 0,
    onTab: vi.fn(),
    onSelectDiff: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<WorkPanel {...props} />) }
}

describe('WorkPanel', () => {
  it('always renders the three tab buttons', () => {
    renderPanel('files')
    expect(screen.getByRole('button', { name: 'Files' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Diff' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Terminal' })).toBeInTheDocument()
  })

  it('renders the files tab with each changed file and its counts', () => {
    const { props } = renderPanel('files')
    for (const c of props.session.changes) {
      expect(screen.getByText(c.path)).toBeInTheDocument()
    }
    // No terminal content while on the files tab.
    expect(screen.queryByText(/12 passed/)).not.toBeInTheDocument()
  })

  it('renders the diff tab with the active file diff', () => {
    renderPanel('diff')
    // Diff body unique to the first change (rateLimit.ts).
    expect(screen.getByText(/interface RateLimitOpts/)).toBeInTheDocument()
  })

  it('honours diffIndex on the diff tab', () => {
    renderPanel('diff', { diffIndex: 1 })
    // Diff body unique to the second change (login.ts).
    expect(screen.getByText(/const router = Router\(\)/)).toBeInTheDocument()
    expect(screen.queryByText(/interface RateLimitOpts/)).not.toBeInTheDocument()
  })

  it('renders the terminal tab with terminal output', () => {
    const { props } = renderPanel('terminal')
    // The first non-empty terminal line is the command prompt.
    const promptLine = props.session.terminal.find((l) => l.startsWith('$'))!
    expect(screen.getByText(promptLine)).toBeInTheDocument()
    expect(screen.getByText(/12 passed/)).toBeInTheDocument()
  })

  it('fires onTab when a tab is clicked', async () => {
    const user = userEvent.setup()
    const onTab = vi.fn()
    renderPanel('files', { onTab })

    await user.click(screen.getByRole('button', { name: 'Diff' }))
    await user.click(screen.getByRole('button', { name: 'Terminal' }))
    await user.click(screen.getByRole('button', { name: 'Files' }))

    expect(onTab).toHaveBeenNthCalledWith(1, 'diff')
    expect(onTab).toHaveBeenNthCalledWith(2, 'terminal')
    expect(onTab).toHaveBeenNthCalledWith(3, 'files')
  })

  it('fires onSelectDiff when a file row is clicked on the files tab', async () => {
    const user = userEvent.setup()
    const onSelectDiff = vi.fn()
    const { props } = renderPanel('files', { onSelectDiff })

    const row = screen.getByText(props.session.changes[1].path).closest('button')
    expect(row).not.toBeNull()
    await user.click(row!)
    expect(onSelectDiff).toHaveBeenCalledWith(1)
  })

  it('fires onClose from the close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderPanel('files', { onClose })

    // The close button is the icon-only button (no accessible name).
    const closeBtn = screen.getAllByRole('button').find((b) => b.textContent === '')
    expect(closeBtn).toBeDefined()
    await user.click(closeBtn!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fires onClose when the backdrop overlay is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { container } = renderPanel('files', { onClose })

    // The overlay is the first element rendered (a full-screen click target).
    const overlay = container.querySelector('div')
    expect(overlay).not.toBeNull()
    await user.click(overlay!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows an empty-state message when there are no file changes', () => {
    const empty = new MockPiService().listSessions().find((s) => (s.changes?.length ?? 0) === 0)
    if (!empty) throw new Error('expected a seeded session with no changes')
    renderPanel('files', { session: empty })
    expect(screen.getByText(/no file changes yet/i)).toBeInTheDocument()
  })
})
