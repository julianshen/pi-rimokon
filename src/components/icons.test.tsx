import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import type { ComponentType } from 'react'
import * as Icons from './icons'
import {
  GridIcon,
  GearIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BranchIcon,
  BaseBranchIcon,
  ClockIcon,
  TreeIcon,
  PanelIcon,
  CloseIcon,
  MenuIcon,
  ArrowRight,
  CheckIcon,
  SparkleIcon,
  BoltIcon,
  QueueIcon,
  ShareIcon,
  RewindIcon,
  BookmarkIcon,
  SpinnerIcon,
  LogoutIcon,
  GitHubIcon,
  MoonIcon,
  SunIcon,
  PiMark,
} from './icons'

// Every plain SVG icon takes an optional `size` prop and renders one <svg>.
const svgIcons: Array<[string, ComponentType<{ size?: number }>]> = [
  ['GridIcon', GridIcon],
  ['GearIcon', GearIcon],
  ['ChevronDown', ChevronDown],
  ['ChevronLeft', ChevronLeft],
  ['ChevronRight', ChevronRight],
  ['BranchIcon', BranchIcon],
  ['BaseBranchIcon', BaseBranchIcon],
  ['ClockIcon', ClockIcon],
  ['TreeIcon', TreeIcon],
  ['PanelIcon', PanelIcon],
  ['CloseIcon', CloseIcon],
  ['MenuIcon', MenuIcon],
  ['ArrowRight', ArrowRight],
  ['CheckIcon', CheckIcon],
  ['SparkleIcon', SparkleIcon],
  ['BoltIcon', BoltIcon],
  ['QueueIcon', QueueIcon],
  ['ShareIcon', ShareIcon],
  ['RewindIcon', RewindIcon],
  ['BookmarkIcon', BookmarkIcon],
  ['SpinnerIcon', SpinnerIcon],
  ['LogoutIcon', LogoutIcon],
  ['GitHubIcon', GitHubIcon],
  ['MoonIcon', MoonIcon],
  ['SunIcon', SunIcon],
]

describe('SVG icons', () => {
  it.each(svgIcons)('%s renders an <svg> with the default size', (_name, Icon) => {
    const { container } = render(<Icon />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it.each(svgIcons)('%s honors a custom size prop', (_name, Icon) => {
    const { container } = render(<Icon size={42} />)
    const svg = container.querySelector('svg')!
    expect(svg).toBeInTheDocument()
    expect(svg.getAttribute('width')).toBe('42')
    expect(svg.getAttribute('height')).toBe('42')
  })

  it('SpinnerIcon merges a passed style with its spin animation', () => {
    const { container } = render(<SpinnerIcon style={{ opacity: 0.5 }} />)
    const svg = container.querySelector('svg')!
    expect(svg.style.opacity).toBe('0.5')
    expect(svg.style.animation).toContain('pi-spin')
  })

  it('exports exactly the expected set of named members', () => {
    // The module's named exports are exactly the SVG icons plus PiMark.
    expect(Object.keys(Icons).sort()).toEqual(
      [...svgIcons.map(([name]) => name), 'PiMark'].sort(),
    )
  })
})

describe('PiMark', () => {
  it('renders the π monogram tile with default sizing', () => {
    const { getByText } = render(<PiMark />)
    expect(getByText('π')).toBeInTheDocument()
  })

  it('accepts custom tile/font/radius props', () => {
    const { getByText } = render(<PiMark tile={46} font={27} radius={13} />)
    const glyph = getByText('π')
    expect(glyph).toBeInTheDocument()
    expect((glyph as HTMLElement).style.fontSize).toBe('27px')
  })
})
