import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ToolKind } from '../../lib/theme'
import { TOOL_META } from '../../lib/theme'
import type { Session } from '../../lib/types'
import { buildThreadView, type AgentThreadItem, type ToolView } from '../../lib/sessionView'
import { MockPiService } from '../../services/MockPiService'
import { ToolCard } from './ToolCard'

// Collect tool views across every session (seeds + a freshly started one, which
// together exercise all six ToolKinds), mirroring how SessionScreen derives tool
// views via buildThreadView(session, step). A large step marks every streamed
// tool as done (no spinner) so meta + diff render.
function allToolViews(): ToolView[] {
  const svc = new MockPiService()
  svc.startSession({ prompt: 'do the thing', repo: 'acme/web-app', model: 'sonnet', skills: {} })
  const views: ToolView[] = []
  for (const sess of svc.listSessions()) {
    const view = buildThreadView(sess, 9999)
    for (const item of view.items) {
      if (item.kind === 'agent') views.push(...(item as AgentThreadItem).tools)
    }
  }
  return views
}

const ALL_KINDS: ToolKind[] = ['read', 'search', 'edit', 'create', 'bash', 'test']

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

describe('ToolCard', () => {
  it('renders the verb, path and meta for a completed tool', () => {
    const views = allToolViews()
    const read = views.find((v) => v.verb === TOOL_META.read.verb && !!v.meta && v.done)
    if (!read || !read.meta) throw new Error('expected a completed read tool view with meta')

    render(<ToolCard tool={read} />)
    expect(screen.getByText(TOOL_META.read.verb)).toBeInTheDocument()
    expect(screen.getByText(read.path)).toBeInTheDocument()
    expect(screen.getByText(read.meta)).toBeInTheDocument()
  })

  it.each(ALL_KINDS)('renders the per-kind verb for kind "%s"', (kind) => {
    const views = allToolViews()
    const verb = TOOL_META[kind].verb
    const view = views.find((v) => v.verb === verb)
    if (!view) throw new Error(`expected a ${kind} tool view`)

    render(<ToolCard tool={view} />)
    // Each kind maps to a distinct verb label rendered in the card header.
    expect(screen.getAllByText(verb).length).toBeGreaterThan(0)
    expect(screen.getByText(view.path)).toBeInTheDocument()
  })

  it('renders a diff body when the tool has diff lines', () => {
    const views = allToolViews()
    const withDiff = views.find((v) => v.hasDiff && v.diff.some((d) => d.code.trim().length > 0))
    if (!withDiff) throw new Error('expected a tool view with a non-empty diff')
    const line = withDiff.diff.find((d) => d.code.trim().length > 0)!

    render(<ToolCard tool={withDiff} />)
    // A diff code line is rendered in the diff body.
    expect(screen.getByText(new RegExp(escapeRegExp(line.code.slice(0, 12))))).toBeInTheDocument()
  })

  it('shows a running spinner and no meta while a tool is still running', () => {
    // Build a tool view in its running state directly from the public view model.
    const sess: Session = {
      ...new MockPiService().listSessions()[0],
    }
    const view = buildThreadView(sess, 0)
    const agent = view.items.find((i): i is AgentThreadItem => i.kind === 'agent')
    if (!agent) throw new Error('expected an agent thread item')
    const running = agent.tools.find((t) => t.running)
    if (!running) throw new Error('expected a running tool at step 0')

    const { container } = render(<ToolCard tool={running} />)
    expect(running.done).toBe(false)

    // The spinner is rendered as a second <svg> carrying the `pi-spin` animation
    // (the first <svg> is the tool's glyph). Asserting the animated one is present
    // proves the running indicator shows, not just any icon.
    expect(container.querySelector('svg[style*="pi-spin"]')).toBeTruthy()
    expect(container.querySelectorAll('svg')).toHaveLength(2)

    // A running tool does not render its completed meta text (rendering is gated
    // on `done`). The seeded running tool carries a `meta`, so its absence is a
    // real signal — not vacuously true.
    expect(running.meta).toBeTruthy()
    expect(screen.queryByText(running.meta as string)).toBeNull()
  })
})
