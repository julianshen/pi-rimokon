import { describe, it, expect } from 'vitest'
import { streamMax, buildThreadView, buildGenUI, numberDiff } from './sessionView'
import { MockPiService } from '../services/MockPiService'
import type { Session, GenUI } from './types'

const svc = new MockPiService()
const sessions = svc.listSessions()
const byId = (id: string): Session => {
  const s = sessions.find((x) => x.id === id)
  if (!s) throw new Error('missing seed session ' + id)
  return s
}

describe('streamMax', () => {
  it('combines tool count, half the word count (rounded up), and a constant', () => {
    const sess = byId('s1')
    const last = sess.thread[sess.thread.length - 1]
    const tools = (last.tools || []).length
    const words = (last.text || '').split(' ').length
    expect(streamMax(sess)).toBe(tools * 5 + Math.ceil(words / 2) + 3)
  })

  it('handles an agent message with no tools and no text', () => {
    const sess: Session = {
      ...byId('s3'),
      thread: [{ role: 'agent', text: '', tools: [] }],
    }
    // no tools, empty text -> ''.split(' ') => [''] length 1 -> ceil(1/2)=1 ; 0*5 + 1 + 3 = 4
    expect(streamMax(sess)).toBe(4)
  })

  it('handles a message with tools but undefined text', () => {
    const sess: Session = {
      ...byId('s3'),
      thread: [{ role: 'agent', tools: [{ kind: 'read', path: 'a' }] }],
    }
    // 1 tool * 5 + ceil(1/2) + 3 = 5 + 1 + 3 = 9
    expect(streamMax(sess)).toBe(9)
  })
})

describe('buildThreadView', () => {
  it('renders a live streaming session: reveals tools progressively at step 0', () => {
    const sess = byId('s1') // live, streaming, last message
    const view = buildThreadView(sess, 0)
    expect(view.items.length).toBe(sess.thread.length)
    const agent = view.items.find((i) => i.kind === 'agent')!
    expect(agent.kind).toBe('agent')
    if (agent.kind === 'agent') {
      // at step 0, only the first tool is visible and it's running
      expect(agent.tools).toHaveLength(1)
      expect(agent.tools[0].running).toBe(true)
      expect(agent.tools[0].done).toBe(false)
      expect(agent.text).toBe('')
    }
    expect(view.working).toBe(true)
    // workingLabel derives from the running tool's verb + path
    expect(view.workingLabel.length).toBeGreaterThan(0)
  })

  it('reveals all tools and partial text once step crosses the text boundary', () => {
    const sess = byId('s1')
    const last = sess.thread[sess.thread.length - 1]
    const T = (last.tools || []).length
    const textStart = T * 5
    // one tick into the text region -> 2 words shown
    const view = buildThreadView(sess, textStart + 1)
    const agent = view.items.find((i) => i.kind === 'agent')!
    if (agent.kind === 'agent') {
      expect(agent.tools).toHaveLength(T)
      expect(agent.tools.every((t) => !t.running)).toBe(true)
      const words = (last.text || '').split(' ')
      expect(agent.text).toBe(words.slice(0, 2).join(' '))
      expect(agent.cursor).toBe(true)
    }
  })

  it('shows full text with no cursor when step reaches streamMax', () => {
    const sess = byId('s1')
    const view = buildThreadView(sess, streamMax(sess))
    const agent = view.items.find((i) => i.kind === 'agent')!
    if (agent.kind === 'agent') {
      expect(agent.text).toBe(sess.thread[sess.thread.length - 1].text)
      expect(agent.cursor).toBe(false)
    }
    // at max, the live working flag is false (step >= streamMax)
    expect(view.working).toBe(false)
  })

  it('emits "Composing response…" when revealing text but no tool is running at that index', () => {
    // A streaming message where the running index points past the tools array.
    const sess: Session = {
      ...byId('s1'),
      live: true,
      thread: [
        { role: 'user', text: 'go' },
        {
          role: 'agent',
          streaming: true,
          intro: 'hi',
          tools: [{ kind: 'read', path: 'a.ts' }],
          text: 'one two three four five six seven eight',
        },
      ],
    }
    const T = 1
    const textStart = T * 5 // 5
    // step within text region but below streamMax so msgWorking is true
    const view = buildThreadView(sess, textStart)
    expect(view.workingLabel).toBe('Composing response…')
  })

  it('renders a user steer message', () => {
    const sess: Session = {
      ...byId('s1'),
      thread: [{ role: 'user', text: 'steer this', steer: true }],
    }
    const view = buildThreadView(sess, 0)
    const user = view.items[0]
    expect(user.kind).toBe('user')
    if (user.kind === 'user') {
      expect(user.text).toBe('steer this')
      expect(user.steer).toBe(true)
    }
  })

  it('renders a done session without working state and exposes genui', () => {
    const sess = byId('s4') // done, has preview genui
    const view = buildThreadView(sess, 0)
    expect(view.working).toBe(false)
    const agent = view.items.find((i) => i.kind === 'agent')!
    if (agent.kind === 'agent') {
      expect(agent.genui).not.toBeNull()
      expect(agent.genui?.type).toBe('preview')
      // a done session does not show the review CTA
      expect(agent.reviewCTA).toBe(false)
    }
  })

  it('shows the review CTA on a non-live review session with changes', () => {
    const sess = byId('s2') // review status, not live, add+del > 0
    const view = buildThreadView(sess, 0)
    const agent = view.items[view.items.length - 1]
    if (agent.kind === 'agent') {
      expect(agent.reviewCTA).toBe(true)
      expect(agent.reviewLabel).toContain('files changed')
      expect(agent.reviewLabel).toContain(`+${sess.add}`)
    }
    // a 'review' session is not "working"
    expect(view.working).toBe(false)
  })

  it('renders a question with options (waiting session)', () => {
    const sess = byId('s5') // waiting, question + options, chart genui
    const view = buildThreadView(sess, 0)
    const agent = view.items[view.items.length - 1]
    if (agent.kind === 'agent') {
      expect(agent.question).toBe(true)
      expect(agent.options.length).toBeGreaterThan(0)
    }
    expect(view.working).toBe(false)
  })

  it('marks a non-live working session as working with its latest as label', () => {
    const sess = byId('s3') // working status, not live (no live flag)
    const view = buildThreadView(sess, 0)
    expect(view.working).toBe(true)
    expect(view.workingLabel).toBe(sess.latest)
  })

  it('renders an error session as not working', () => {
    const sess = byId('s6')
    const view = buildThreadView(sess, 0)
    expect(view.working).toBe(false)
  })

  it('builds diff line views for tool calls with diffs once done', () => {
    // live session at max so the edit/create tools are done and expose their diffs
    const sess = byId('s1')
    const view = buildThreadView(sess, streamMax(sess))
    const agent = view.items.find((i) => i.kind === 'agent')!
    if (agent.kind === 'agent') {
      const withDiff = agent.tools.find((t) => t.hasDiff)
      expect(withDiff).toBeDefined()
      expect(withDiff!.diff.length).toBeGreaterThan(0)
      // diff line views carry bg/fg/sign
      expect(withDiff!.diff[0]).toHaveProperty('bg')
      expect(withDiff!.diff[0]).toHaveProperty('sign')
    }
  })

  it('handles a user message with no text and an agent message with no tools key', () => {
    const sess: Session = {
      ...byId('s1'),
      live: true,
      thread: [
        // user message with text undefined -> falls back to ''
        { role: 'user' },
        // streaming agent with no tools array and no text
        { role: 'agent', streaming: true, intro: 'hi' },
      ],
    }
    const view = buildThreadView(sess, 0)
    const user = view.items[0]
    expect(user.kind).toBe('user')
    if (user.kind === 'user') expect(user.text).toBe('')
    const agent = view.items[1]
    if (agent.kind === 'agent') {
      expect(agent.tools).toEqual([])
      expect(agent.text).toBe('')
    }
  })

  it('labels an unknown running tool kind with just its path (no verb)', () => {
    const sess: Session = {
      ...byId('s1'),
      live: true,
      thread: [
        { role: 'user', text: 'go' },
        {
          role: 'agent',
          streaming: true,
          intro: 'hi',
          // unknown kind -> TOOL_META[kind] is undefined in the workingLabel branch
          // @ts-expect-error intentional unknown kind
          tools: [{ kind: 'mystery', path: 'weird/op' }],
          text: 'a b c d',
        },
      ],
    }
    // step 0 -> first (unknown) tool is the running one; workingLabel omits the verb
    const view = buildThreadView(sess, 0)
    expect(view.workingLabel).toBe('weird/op')
  })

  it('falls back to the read tool meta for an unknown tool kind', () => {
    const sess: Session = {
      ...byId('s4'),
      live: false,
      thread: [
        { role: 'user', text: 'go' },
        // @ts-expect-error intentional unknown kind to exercise the fallback
        { role: 'agent', tools: [{ kind: 'mystery', path: 'x' }], text: 'done' },
      ],
    }
    const view = buildThreadView(sess, 0)
    const agent = view.items[view.items.length - 1]
    if (agent.kind === 'agent') {
      expect(agent.tools[0].verb).toBe('Read') // TOOL_META.read fallback
    }
  })
})

describe('buildGenUI', () => {
  it('builds a chart view from a series, sizing bars relative to the max', () => {
    const g = byId('s5').thread[1].genui as GenUI
    const view = buildGenUI(g, false)
    expect(view).not.toBeNull()
    expect(view!.type).toBe('chart')
    if (view && view.type === 'chart') {
      expect(view.title).toBe(g.title)
      expect(view.tag).toBe('values in ' + g.unit)
      expect(view.note).toBe(g.note)
      expect(view.bars).toHaveLength(g.series!.length)
      // a spike bar gets the spike color
      const spike = view.bars.find((b) => b.valColor === '#c0432f')
      expect(spike).toBeDefined()
      // the tallest bar maps to the max value
      expect(view.bars.some((b) => b.barStyle.height === '100%')).toBe(true)
    }
  })

  it('chart tag is empty when no unit is provided', () => {
    const g: GenUI = { type: 'chart', title: 'T', series: [{ t: 'a', v: 10 }] }
    const view = buildGenUI(g, false)
    if (view && view.type === 'chart') {
      expect(view.tag).toBe('')
      expect(view.note).toBe('')
    }
  })

  it('returns null for a chart with no series', () => {
    const g: GenUI = { type: 'chart', title: 'no data' }
    expect(buildGenUI(g, false)).toBeNull()
  })

  it('builds a light preview view', () => {
    const g: GenUI = { type: 'preview', title: 'Settings preview' }
    const view = buildGenUI(g, false)
    expect(view).not.toBeNull()
    if (view && view.type === 'preview') {
      expect(view.dark).toBe(false)
      expect(view.tag).toBe('theme: light')
      expect(view.paneStyle.background).toBe('#ffffff')
    }
  })

  it('builds a dark preview view with dark tokens', () => {
    const g: GenUI = { type: 'preview', title: 'Settings preview' }
    const view = buildGenUI(g, true)
    if (view && view.type === 'preview') {
      expect(view.dark).toBe(true)
      expect(view.tag).toBe('theme: dark')
      expect(view.paneStyle.background).toBe('#15171c')
      // dark knob position differs from light
      expect(view.knobStyle.left).toBe(20)
    }
  })

  it('returns null for an unknown genui type', () => {
    // @ts-expect-error intentional unknown type to exercise the fallback
    expect(buildGenUI({ type: 'mystery', title: 'x' }, false)).toBeNull()
  })
})

describe('numberDiff', () => {
  it('numbers added/context lines and blanks hunk headers and removals', () => {
    const diff = [
      { t: '@', c: '@@ hunk @@' },
      { t: ' ', c: 'context' },
      { t: '+', c: 'added' },
      { t: '-', c: 'removed' },
      { t: '+', c: 'added2' },
    ]
    const out = numberDiff(diff)
    expect(out.map((l) => l.ln)).toEqual(['', 1, 2, '', 3])
    // signs are mapped (− for removals, blank for hunk)
    expect(out[0].sign).toBe('')
    expect(out[3].sign).toBe('−')
  })

  it('falls back to the context style for an unknown sign', () => {
    const out = numberDiff([{ t: '?', c: 'weird' }])
    expect(out[0].sign).toBe(' ')
    expect(out[0].bg).toBe('transparent')
    // unknown sign is treated like context for numbering
    expect(out[0].ln).toBe(1)
  })

  it('returns an empty array for an empty diff', () => {
    expect(numberDiff([])).toEqual([])
  })
})
