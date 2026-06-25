import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '../hooks/useTheme'
import { MockPiService } from '../services/MockPiService'
import type { Session } from '../lib/types'
import { SessionScreen } from './SessionScreen'

const sessions = new MockPiService().listSessions()
const byStatus = (status: Session['status']) =>
  sessions.find((s) => s.status === status) as Session

// Pick sessions with varied status to exercise distinct branches.
// A non-live "working" session renders the working bar + Stop button (see buildThreadView).
const workingSession = sessions.find((s) => s.status === 'working' && !s.live) as Session
const reviewSession = byStatus('review') // changes present -> "Review changes" CTA
const waitingSession = byStatus('waiting') // thread asks a question -> option buttons

type Props = Parameters<typeof SessionScreen>[0]

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    session: reviewSession,
    step: 999, // past the stream max so nothing is mid-stream
    mobile: false,
    model: 'sonnet',
    modelMenu: false,
    rightOpen: false,
    composer: '',
    sendMode: 'steer',
    queued: [],
    genuiTheme: 'light',
    onToggleModelMenu: vi.fn(),
    onPickModel: vi.fn(),
    onToggleTree: vi.fn(),
    onToggleRight: vi.fn(),
    onGoHome: vi.fn(),
    onComposerChange: vi.fn(),
    onSend: vi.fn(),
    onSendMode: vi.fn(),
    onRemoveQueued: vi.fn(),
    onStop: vi.fn(),
    onToggleGenuiTheme: vi.fn(),
    onPickOption: vi.fn(),
    onReview: vi.fn(),
    ...overrides,
  }
}

function setup(overrides: Partial<Props> = {}) {
  const props = makeProps(overrides)
  const utils = render(
    <ThemeProvider>
      <SessionScreen {...props} />
    </ThemeProvider>,
  )
  return { props, ...utils }
}

describe('SessionScreen', () => {
  it('renders the session title, repo/branch and status pill', () => {
    setup({ session: reviewSession })
    expect(screen.getByRole('heading', { name: reviewSession.title })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(reviewSession.repo))).toBeInTheDocument()
    // review status maps to the "Needs review" label
    expect(screen.getByText('Needs review')).toBeInTheDocument()
  })

  it('shows the model label on desktop and toggles the model menu', async () => {
    const user = userEvent.setup()
    const { props } = setup({ mobile: false, model: 'sonnet' })
    // modelLabel strips the "Claude " prefix
    expect(screen.getByText('Sonnet 4.5')).toBeInTheDocument()
    await user.click(screen.getByText('Sonnet 4.5'))
    expect(props.onToggleModelMenu).toHaveBeenCalledTimes(1)
  })

  it('hides the model label and shows a back button on mobile', async () => {
    const user = userEvent.setup()
    const { props } = setup({ mobile: true })
    // label hidden on mobile
    expect(screen.queryByText('Sonnet 4.5')).toBeNull()
    // first header button is the back-to-home control
    const buttons = screen.getAllByRole('button')
    await user.click(buttons[0])
    expect(props.onGoHome).toHaveBeenCalledTimes(1)
  })

  it('renders the model menu and forwards a pick when open', async () => {
    const user = userEvent.setup()
    const { props } = setup({ modelMenu: true })
    expect(screen.getByText(/switch model/i)).toBeInTheDocument()
    await user.click(screen.getByText('GPT-5'))
    expect(props.onPickModel).toHaveBeenCalledWith('gpt5')
  })

  it('does not render the model menu when closed', () => {
    setup({ modelMenu: false })
    expect(screen.queryByText(/switch model/i)).toBeNull()
  })

  it('fires the tree and work-panel toggles', async () => {
    const user = userEvent.setup()
    const { props } = setup()
    await user.click(screen.getByTitle('Session tree'))
    expect(props.onToggleTree).toHaveBeenCalledTimes(1)
    await user.click(screen.getByTitle('Work panel'))
    expect(props.onToggleRight).toHaveBeenCalledTimes(1)
  })

  it('renders with the work panel open (rightOpen branch)', () => {
    setup({ rightOpen: true })
    // the panel toggle still renders and remains interactive
    expect(screen.getByTitle('Work panel')).toBeInTheDocument()
  })

  it('shows a working bar with a Stop button for an active working session', async () => {
    const user = userEvent.setup()
    const { props } = setup({ session: workingSession })
    const stop = screen.getByRole('button', { name: 'Stop' })
    await user.click(stop)
    expect(props.onStop).toHaveBeenCalledTimes(1)
  })

  it('forwards composer typing and send', async () => {
    const user = userEvent.setup()
    const { props } = setup({ session: reviewSession })
    await user.type(screen.getByRole('textbox'), 'hi')
    expect(props.onComposerChange).toHaveBeenCalled()
    // review session is not working -> the primary action reads "Send"
    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(props.onSend).toHaveBeenCalledTimes(1)
  })

  it('switches send mode via the segmented control', async () => {
    const user = userEvent.setup()
    const { props } = setup({ sendMode: 'steer', session: reviewSession })
    await user.click(screen.getByRole('button', { name: 'Follow-up' }))
    expect(props.onSendMode).toHaveBeenCalledWith('follow')
  })

  it('renders queued items and removes them', async () => {
    const user = userEvent.setup()
    const { props } = setup({ queued: ['run the linter'], session: reviewSession })
    expect(screen.getByText('run the linter')).toBeInTheDocument()
    // the queue chip's only button is its remove control; the label sits in an
    // inner span, so step out to the outer chip that also holds the button
    const chip = screen.getByText('run the linter').parentElement as HTMLElement
    await user.click(within(chip).getByRole('button'))
    expect(props.onRemoveQueued).toHaveBeenCalledWith(0)
  })

  it('exposes the review CTA for a session with changes and forwards onReview', async () => {
    const user = userEvent.setup()
    const { props } = setup({ session: reviewSession })
    const review = screen.getByRole('button', { name: /review changes/i })
    await user.click(review)
    expect(props.onReview).toHaveBeenCalledTimes(1)
  })

  it('renders question options for a waiting session and forwards the pick', async () => {
    const user = userEvent.setup()
    const option = waitingSession.thread
      .flatMap((m) => (m.role === 'agent' ? m.options ?? [] : []))
      .find(Boolean) as string
    const { props } = setup({ session: waitingSession })
    await user.click(screen.getByRole('button', { name: option }))
    expect(props.onPickOption).toHaveBeenCalledWith(option)
  })
})
