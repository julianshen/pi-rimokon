import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '../../lib/types'
import { buildThreadView } from '../../lib/sessionView'
import { MockPiService } from '../../services/MockPiService'
import { Thread } from './Thread'

// Mirror how SessionScreen derives Thread's props: build the renderable thread
// for a session at a given stream step, then pass view.items straight through.
function sessionById(id: string): Session {
  const sess = new MockPiService().listSessions().find((s) => s.id === id)
  if (!sess) throw new Error(`no seeded session ${id}`)
  return sess
}

interface RenderOpts {
  genuiTheme?: 'light' | 'dark'
  onToggleGenuiTheme?: () => void
  onPickOption?: (option: string) => void
  onReview?: () => void
}

function renderThread(session: Session, step: number, opts: RenderOpts = {}) {
  const view = buildThreadView(session, step)
  const props = {
    genuiTheme: opts.genuiTheme ?? ('light' as const),
    onToggleGenuiTheme: opts.onToggleGenuiTheme ?? vi.fn(),
    onPickOption: opts.onPickOption ?? vi.fn(),
    onReview: opts.onReview ?? vi.fn(),
  }
  render(<Thread items={view.items} {...props} />)
  return { view, ...props }
}

describe('Thread', () => {
  it('renders user and agent turns with the agent intro and final text', () => {
    const sess = sessionById('s1')
    renderThread(sess, 9999)

    // User turn label + the user's prompt.
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText(/Add rate limiting to the API login endpoint/)).toBeInTheDocument()

    // Agent turn label, intro and (fully streamed) final text.
    expect(screen.getByText('Pi')).toBeInTheDocument()
    expect(screen.getByText(/token-bucket limiter and wire it into the login router/)).toBeInTheDocument()
    expect(screen.getByText(/All 12 auth tests pass/)).toBeInTheDocument()
  })

  it('renders the agent tool calls for a turn', () => {
    const sess = sessionById('s1')
    renderThread(sess, 9999)

    // Tool paths from the seed render inside the cards.
    expect(screen.getByText('src/auth/login.ts')).toBeInTheDocument()
    expect(screen.getByText('src/middleware/rateLimit.ts')).toBeInTheDocument()
    expect(screen.getByText('npm test -- auth')).toBeInTheDocument()
  })

  it('fires onReview when the review CTA is clicked', async () => {
    const user = userEvent.setup()
    const onReview = vi.fn()
    const sess = sessionById('s1')
    renderThread(sess, 9999, { onReview })

    const reviewBtn = screen.getByRole('button', { name: /review changes/i })
    expect(screen.getByText(/files changed/)).toBeInTheDocument()
    await user.click(reviewBtn)
    expect(onReview).toHaveBeenCalledTimes(1)
  })

  it('renders question options and fires onPickOption with the chosen option', async () => {
    const user = userEvent.setup()
    const onPickOption = vi.fn()
    // s5 ends on an agent question with steer options + a chart genui.
    const sess = sessionById('s5')
    renderThread(sess, 9999, { onPickOption })

    const option = 'Roll back the 14:10 deploy first'
    expect(screen.getByText(/which environment is affected|need a steer/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: option }))
    expect(onPickOption).toHaveBeenCalledWith(option)
  })

  it('renders an embedded generative-UI chart for a turn', () => {
    const sess = sessionById('s5')
    renderThread(sess, 9999)
    // The genui header + chart title come from GenUIBlock nested in the thread.
    expect(screen.getByText('Generative UI')).toBeInTheDocument()
    expect(screen.getByText('Checkout p95 latency — last 24h')).toBeInTheDocument()
  })

  it('renders an embedded generative-UI preview and forwards the toggle', async () => {
    const user = userEvent.setup()
    const onToggleGenuiTheme = vi.fn()
    // s4 carries a preview-type genui.
    const sess = sessionById('s4')
    renderThread(sess, 9999, { onToggleGenuiTheme })

    expect(screen.getByText('Settings.tsx — live preview')).toBeInTheDocument()
    // The preview toggle is the only button in this (done) thread; it forwards up.
    await user.click(screen.getByRole('button'))
    expect(onToggleGenuiTheme).toHaveBeenCalledTimes(1)
  })

  it('shows a steered badge on a user turn that steered an in-flight run', () => {
    // Clone the seed so appending a steering turn doesn't mutate shared state,
    // matching how the composer adds a steer ({ role: 'user', steer: true }).
    const base = sessionById('s1')
    const sess: Session = {
      ...base,
      thread: [...base.thread, { role: 'user', text: 'Also add a unit test for the limiter', steer: true }],
    }
    const view = buildThreadView(sess, 9999)
    render(
      <Thread
        items={view.items}
        genuiTheme="light"
        onToggleGenuiTheme={vi.fn()}
        onPickOption={vi.fn()}
        onReview={vi.fn()}
      />,
    )
    expect(screen.getByText(/steered/i)).toBeInTheDocument()
    expect(screen.getByText('Also add a unit test for the limiter')).toBeInTheDocument()
  })

  it('reveals a blinking cursor mid-stream and the partial text grows with step', () => {
    const sess = sessionById('s1')
    // Pick a step partway through the text reveal: tools shown, text partial.
    const T = (sess.thread[sess.thread.length - 1].tools || []).length
    const midStep = T * 5 + 4

    const { view } = renderThread(sess, midStep)
    const agent = view.items.find((i) => i.kind === 'agent')
    if (!agent || agent.kind !== 'agent') throw new Error('expected agent item')

    // Mid-stream the text is non-empty but not yet the full message, and a cursor shows.
    expect(agent.text.length).toBeGreaterThan(0)
    expect(agent.cursor).toBe(true)
    expect(screen.getByText(/^Done\./)).toBeInTheDocument()
  })
})
