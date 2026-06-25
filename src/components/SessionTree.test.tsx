import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '../hooks/useTheme'
import { MockPiService } from '../services/MockPiService'
import type { Session } from '../lib/types'
import { SessionTree } from './SessionTree'

const sessions = new MockPiService().listSessions()
// s1 has a rich tree: root, current, bookmark, and a branch node with canRewind.
const richSession = sessions.find((s) => s.tree.some((n) => n.canRewind)) as Session

function setup(session: Session = richSession) {
  const onClose = vi.fn()
  const onRewind = vi.fn()
  const utils = render(
    <ThemeProvider>
      <SessionTree session={session} onClose={onClose} onRewind={onRewind} />
    </ThemeProvider>,
  )
  return { onClose, onRewind, ...utils }
}

describe('SessionTree', () => {
  it('renders the tree heading and every node label', () => {
    setup()
    expect(screen.getByText('Session tree')).toBeInTheDocument()
    for (const node of richSession.tree) {
      expect(screen.getByText(node.label)).toBeInTheDocument()
    }
  })

  it('marks the current node with a "current" badge', () => {
    setup()
    // "current" appears as the badge (and may also be a node's meta), so just
    // assert the badge text is rendered at least once
    expect(screen.getAllByText('current').length).toBeGreaterThanOrEqual(1)
  })

  it('invokes onClose when the overlay is clicked', async () => {
    const user = userEvent.setup()
    const { onClose, container } = setup()
    // the scrim is the first fixed element rendered before the aside
    const overlay = container.querySelector('div')!
    await user.click(overlay)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('invokes onClose when the close (X) button is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()
    // header has a "/share" button and an icon-only close button; the close
    // button is the one with no accessible text
    const closeBtn = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.trim() === '') as HTMLElement
    await user.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('invokes onRewind from a rewindable branch node', async () => {
    const user = userEvent.setup()
    const { onRewind } = setup()
    await user.click(screen.getByRole('button', { name: /rewind & branch here/i }))
    expect(onRewind).toHaveBeenCalledTimes(1)
  })

  it('renders without a rewind button when no node is rewindable', () => {
    const plain = sessions.find((s) => s.tree.length > 0 && !s.tree.some((n) => n.canRewind)) as Session
    setup(plain)
    expect(screen.queryByRole('button', { name: /rewind & branch here/i })).toBeNull()
  })
})
