import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ToolKind } from '../../lib/theme'
import { TOOL_META } from '../../lib/theme'
import type { Session } from '../../lib/types'
import { buildThreadView, type AgentThreadItem, type ToolView } from '../../lib/sessionView'
import { MockPiService } from '../../services/MockPiService'
import { ToolCard } from './ToolCard'

// A freshly started session contains a single agent message exercising every
// ToolKind (read/search/edit/create/bash/test), mirroring how SessionScreen
// derives tool views via buildThreadView(session, step).
function toolViewsForAllKinds(): ToolView[] {
  const sess = new MockPiService().startSession({
    prompt: 'do the thing',
    repo: 'acme/web-app',
    model: 'sonnet',
    skills: {},
  })
  // A large step marks every streamed tool as done (no spinner) so meta + diff render.
  const view = buildThreadView(sess, 9999)
  const agent = view.items.find((i): i is AgentThreadItem => i.kind === 'agent')
  if (!agent) throw new Error('expected an agent thread item')
  return agent.tools
}

const ALL_KINDS: ToolKind[] = ['read', 'search', 'edit', 'create', 'bash', 'test']

describe('ToolCard', () => {
  it('renders the verb, path and meta for a completed tool', () => {
    const views = toolViewsForAllKinds()
    const read = views.find((v) => v.verb === TOOL_META.read.verb)
    if (!read) throw new Error('expected a read tool view')

    render(<ToolCard tool={read} />)
    expect(screen.getByText(TOOL_META.read.verb)).toBeInTheDocument()
    expect(screen.getByText(read.path)).toBeInTheDocument()
    if (read.meta) expect(screen.getByText(read.meta)).toBeInTheDocument()
  })

  it.each(ALL_KINDS)('renders the per-kind verb for kind "%s"', (kind) => {
    const views = toolViewsForAllKinds()
    const verb = TOOL_META[kind].verb
    const view = views.find((v) => v.verb === verb)
    if (!view) throw new Error(`expected a ${kind} tool view`)

    render(<ToolCard tool={view} />)
    // Each kind maps to a distinct verb label rendered in the card header.
    expect(screen.getAllByText(verb).length).toBeGreaterThan(0)
    expect(screen.getByText(view.path)).toBeInTheDocument()
  })

  it('renders a diff body when the tool has diff lines', () => {
    const views = toolViewsForAllKinds()
    const withDiff = views.find((v) => v.hasDiff)
    if (!withDiff) throw new Error('expected a tool view with a diff')

    render(<ToolCard tool={withDiff} />)
    // The seed "create" tool diff contains the rateLimit function signature.
    expect(screen.getByText(/rateLimit/)).toBeInTheDocument()
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
    // A running tool does not render its completed meta text.
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
