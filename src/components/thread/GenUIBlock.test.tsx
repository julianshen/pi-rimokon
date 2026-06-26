import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GenUI, Session } from '../../lib/types'
import { MockPiService } from '../../services/MockPiService'
import { GenUIBlock } from './GenUIBlock'

// Pull the seeded generative-UI payloads straight from the mock service so the
// tests exercise the same data the app renders.
function genuiOfType(type: GenUI['type']): GenUI {
  const sessions: Session[] = new MockPiService().listSessions()
  for (const s of sessions) {
    for (const m of s.thread) {
      if (m.genui && m.genui.type === type) return m.genui
    }
  }
  throw new Error(`no seeded genui of type ${type}`)
}

describe('GenUIBlock', () => {
  it('renders the preview widget in light mode and toggles via the callback', async () => {
    const user = userEvent.setup()
    const onToggleTheme = vi.fn()
    const genui = genuiOfType('preview')

    render(<GenUIBlock genui={genui} dark={false} onToggleTheme={onToggleTheme} />)

    expect(screen.getByText('Generative UI')).toBeInTheDocument()
    expect(screen.getByText(genui.title)).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Dark mode')).toBeInTheDocument()
    expect(screen.getByText('theme: light')).toBeInTheDocument()

    // The toggle button drives the onToggleTheme callback.
    await user.click(screen.getByRole('button'))
    expect(onToggleTheme).toHaveBeenCalledTimes(1)
  })

  it('renders the preview widget in dark mode (dark branch)', () => {
    const genui = genuiOfType('preview')
    render(<GenUIBlock genui={genui} dark={true} onToggleTheme={vi.fn()} />)

    expect(screen.getByText('theme: dark')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Reduce motion')).toBeInTheDocument()
  })

  it('renders a chart widget with its bars, unit tag and note', () => {
    const genui = genuiOfType('chart')
    render(<GenUIBlock genui={genui} dark={false} onToggleTheme={vi.fn()} />)

    expect(screen.getByText(genui.title)).toBeInTheDocument()
    if (genui.unit) expect(screen.getByText(`values in ${genui.unit}`)).toBeInTheDocument()
    if (genui.note) expect(screen.getByText(genui.note)).toBeInTheDocument()
    // Each series point renders its label and value.
    for (const point of genui.series ?? []) {
      expect(screen.getByText(point.t)).toBeInTheDocument()
    }
  })

  it('renders the same chart in dark mode without error', () => {
    const genui = genuiOfType('chart')
    render(<GenUIBlock genui={genui} dark={true} onToggleTheme={vi.fn()} />)
    expect(screen.getByText(genui.title)).toBeInTheDocument()
  })

  it('renders nothing when the genui payload is not buildable', () => {
    // A preview/chart with no series produces no view (buildGenUI returns null).
    const empty: GenUI = { type: 'chart', title: 'no data' }
    const { container } = render(<GenUIBlock genui={empty} dark={false} onToggleTheme={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
