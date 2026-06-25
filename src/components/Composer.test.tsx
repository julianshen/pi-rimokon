import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Composer } from './Composer'

type Props = React.ComponentProps<typeof Composer>

function renderComposer(overrides: Partial<Props> = {}) {
  const props: Props = {
    working: false,
    workingLabel: 'Working on it…',
    composer: '',
    sendMode: 'steer',
    queued: [],
    onComposerChange: vi.fn(),
    onSend: vi.fn(),
    onSendMode: vi.fn(),
    onRemoveQueued: vi.fn(),
    onStop: vi.fn(),
    ...overrides,
  }
  render(<Composer {...props} />)
  return props
}

describe('Composer', () => {
  it('renders the segmented Steer / Follow-up control and a Send button when idle', () => {
    renderComposer({ working: false, sendMode: 'steer' })
    expect(screen.getByRole('button', { name: 'Steer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Follow-up' })).toBeInTheDocument()
    // Idle + steer mode -> action button reads "Send".
    expect(screen.getByRole('button', { name: /Send/ })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Reply to Pi/)).toBeInTheDocument()
  })

  it('shows the working banner, label and Stop button while working', () => {
    renderComposer({ working: true, workingLabel: 'Editing rateLimit.ts' })
    expect(screen.getByText('Editing rateLimit.ts')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByText('↵ to steer')).toBeInTheDocument()
    // Working placeholder differs from the idle one.
    expect(screen.getByPlaceholderText(/Steer the agent while it works/)).toBeInTheDocument()
  })

  it('hides the working banner and Stop button when idle', () => {
    renderComposer({ working: false })
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
    expect(screen.queryByText('↵ to steer')).not.toBeInTheDocument()
  })

  it('labels the action button "Steer" while working in steer mode', () => {
    renderComposer({ working: true, sendMode: 'steer' })
    // Both the segmented "Steer" toggle and the action button read "Steer".
    expect(screen.getAllByRole('button', { name: /Steer/ })).toHaveLength(2)
    // The steer-mode hint is shown.
    expect(screen.getByText('↵ steer · ⌥↵ queue · ⇧↵ newline')).toBeInTheDocument()
  })

  it('labels the action button "Queue" and shows the follow hint in follow mode', () => {
    renderComposer({ sendMode: 'follow' })
    expect(screen.getByRole('button', { name: /Queue/ })).toBeInTheDocument()
    expect(screen.getByText('↵ queue · ⇧↵ newline')).toBeInTheDocument()
  })

  it('renders no queued chips when the queue is empty', () => {
    renderComposer({ queued: [] })
    expect(screen.queryByText('First queued task')).not.toBeInTheDocument()
  })

  it('renders a chip per queued item', () => {
    renderComposer({ queued: ['First queued task', 'Second queued task'] })
    expect(screen.getByText('First queued task')).toBeInTheDocument()
    expect(screen.getByText('Second queued task')).toBeInTheDocument()
  })

  it('fires onRemoveQueued with the chip index when its close button is clicked', async () => {
    const user = userEvent.setup()
    const props = renderComposer({ queued: ['Task A', 'Task B'] })
    // Each chip has a single (icon-only) button — its remove control.
    const removeButtons = screen.getAllByRole('button')
    // The chip remove buttons precede the segmented + send controls; click the
    // one belonging to "Task B" by locating it relative to the chip text.
    const chipB = screen.getByText('Task B').closest('span')!
    const removeB = chipB.querySelector('button')!
    expect(removeButtons).toContain(removeB)
    await user.click(removeB)
    expect(props.onRemoveQueued).toHaveBeenCalledWith(1)
  })

  it('reflects the controlled composer value and fires onComposerChange on input', async () => {
    const user = userEvent.setup()
    const props = renderComposer({ composer: 'draft text' })
    const textarea = screen.getByDisplayValue('draft text')
    await user.type(textarea, '!')
    expect(props.onComposerChange).toHaveBeenCalled()
  })

  it('fires onSend when the action button is clicked', async () => {
    const user = userEvent.setup()
    const props = renderComposer()
    await user.click(screen.getByRole('button', { name: /Send/ }))
    expect(props.onSend).toHaveBeenCalledTimes(1)
  })

  it('switches mode via the segmented control buttons', async () => {
    const user = userEvent.setup()
    const props = renderComposer({ sendMode: 'steer' })
    await user.click(screen.getByRole('button', { name: 'Follow-up' }))
    expect(props.onSendMode).toHaveBeenCalledWith('follow')
    await user.click(screen.getByRole('button', { name: 'Steer' }))
    expect(props.onSendMode).toHaveBeenCalledWith('steer')
  })

  it('fires onStop when the Stop button is clicked', async () => {
    const user = userEvent.setup()
    const props = renderComposer({ working: true })
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(props.onStop).toHaveBeenCalledTimes(1)
  })

  it('sends on Enter honoring the active mode (steer)', async () => {
    const user = userEvent.setup()
    const props = renderComposer({ sendMode: 'steer' })
    const textarea = screen.getByPlaceholderText(/Reply to Pi/)
    textarea.focus()
    await user.keyboard('{Enter}')
    expect(props.onSendMode).toHaveBeenCalledWith('steer')
    expect(props.onSend).toHaveBeenCalledTimes(1)
  })

  it('queues on Alt+Enter regardless of the active mode', async () => {
    const user = userEvent.setup()
    const props = renderComposer({ sendMode: 'steer' })
    const textarea = screen.getByPlaceholderText(/Reply to Pi/)
    textarea.focus()
    await user.keyboard('{Alt>}{Enter}{/Alt}')
    expect(props.onSendMode).toHaveBeenCalledWith('follow')
    expect(props.onSend).toHaveBeenCalledTimes(1)
  })

  it('does not send on Shift+Enter (newline)', async () => {
    const user = userEvent.setup()
    const props = renderComposer()
    const textarea = screen.getByPlaceholderText(/Reply to Pi/)
    textarea.focus()
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    expect(props.onSend).not.toHaveBeenCalled()
  })
})
