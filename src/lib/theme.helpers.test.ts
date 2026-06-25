import { describe, it, expect } from 'vitest'
import {
  STATUS,
  statusOf,
  pillStyle,
  dotStyle,
  TOOL_META,
  diffLineStyle,
  fileBadgeColors,
  type StatusKey,
} from './theme'

describe('statusOf', () => {
  const keys: StatusKey[] = ['working', 'review', 'waiting', 'done', 'error']
  it.each(keys)('returns the matching definition for "%s"', (key) => {
    expect(statusOf(key)).toBe(STATUS[key])
    expect(statusOf(key).key).toBe(key)
  })

  it('falls back to the working status for an unknown key', () => {
    // @ts-expect-error intentional unknown key to exercise the fallback
    expect(statusOf('nope')).toBe(STATUS.working)
  })
})

describe('pillStyle', () => {
  it('reflects the status color and background', () => {
    const style = pillStyle(STATUS.review)
    expect(style.color).toBe('var(--pi-blue)')
    expect(style.background).toBe('var(--pi-blue-soft)')
    expect(style.display).toBe('inline-flex')
    expect(style.borderRadius).toBe(20)
  })
})

describe('dotStyle', () => {
  it('uses size 6 by default and includes a pulse animation when the status pulses', () => {
    const style = dotStyle(STATUS.working)
    expect(style.width).toBe(6)
    expect(style.height).toBe(6)
    expect(style.background).toBe('var(--pi-amber)')
    expect(style.animation).toBe('pi-pulse 1.4s infinite')
  })

  it('uses size 7 when big is true', () => {
    const style = dotStyle(STATUS.working, true)
    expect(style.width).toBe(7)
    expect(style.height).toBe(7)
  })

  it('omits the animation for a non-pulsing status', () => {
    const style = dotStyle(STATUS.done, false)
    expect(style.width).toBe(6)
    expect(style.animation).toBeUndefined()
  })

  it('big with a non-pulsing status: size 7, no animation', () => {
    const style = dotStyle(STATUS.review, true)
    expect(style.width).toBe(7)
    expect(style.animation).toBeUndefined()
  })
})

describe('TOOL_META', () => {
  it('co-locates each tool kind accent color with its icon-chip background', () => {
    expect(TOOL_META.read.bg).toBe('var(--pi-border-hair)')
    expect(TOOL_META.search.bg).toBe('var(--pi-border-hair)')
    expect(TOOL_META.edit.color).toBe('var(--pi-blue)')
    expect(TOOL_META.edit.bg).toBe('var(--pi-blue-soft)')
    expect(TOOL_META.create.bg).toBe('var(--pi-green-soft)')
    expect(TOOL_META.test.bg).toBe('var(--pi-green-soft)')
    expect(TOOL_META.bash.bg).toBe('var(--pi-surface-alt)')
  })

  it('every TOOL_META entry has a defined verb, icon, color and bg', () => {
    for (const meta of Object.values(TOOL_META)) {
      expect(meta.verb).toBeTruthy()
      expect(meta.icon).toBeTruthy()
      expect(meta.color).toContain('var(--pi-')
      expect(meta.bg).toContain('var(--pi-')
    }
  })
})

describe('diffLineStyle', () => {
  it('styles added lines', () => {
    const s = diffLineStyle('+')
    expect(s.bg).toBe('var(--pi-diff-add-bg)')
    expect(s.fg).toBe('var(--pi-diff-add-fg)')
    expect(s.sign).toBe('+')
  })
  it('styles removed lines (with a minus glyph)', () => {
    const s = diffLineStyle('-')
    expect(s.bg).toBe('var(--pi-diff-del-bg)')
    expect(s.fg).toBe('var(--pi-diff-del-fg)')
    expect(s.sign).toBe('−')
  })
  it('styles context lines transparently', () => {
    const s = diffLineStyle(' ')
    expect(s.bg).toBe('transparent')
    expect(s.fg).toBe('var(--pi-text-context)')
    expect(s.sign).toBe(' ')
  })
  it('styles hunk headers with no sign', () => {
    const s = diffLineStyle('@')
    expect(s.bg).toBe('var(--pi-diff-hunk-bg)')
    expect(s.fg).toBe('var(--pi-diff-hunk-fg)')
    expect(s.sign).toBe('')
  })
  it('falls back to the context style for an unknown sign', () => {
    // @ts-expect-error intentional unknown sign to exercise the fallback
    const s = diffLineStyle('?')
    expect(s.bg).toBe('transparent')
    expect(s.fg).toBe('var(--pi-text-context)')
  })
})

describe('fileBadgeColors', () => {
  it('colors Added files green', () => {
    const s = fileBadgeColors('A')
    expect(s.c).toBe('var(--pi-green)')
    expect(s.bg).toBe('var(--pi-green-soft)')
  })
  it('colors Modified files blue', () => {
    const s = fileBadgeColors('M')
    expect(s.c).toBe('var(--pi-blue)')
    expect(s.bg).toBe('var(--pi-blue-soft)')
  })
  it('colors Deleted files red', () => {
    const s = fileBadgeColors('D')
    expect(s.c).toBe('var(--pi-red)')
    expect(s.bg).toBe('var(--pi-red-soft)')
  })
  it('falls back to the Modified colors for an unknown status', () => {
    const s = fileBadgeColors('Z')
    expect(s.c).toBe('var(--pi-blue)')
    expect(s.bg).toBe('var(--pi-blue-soft)')
  })
})
