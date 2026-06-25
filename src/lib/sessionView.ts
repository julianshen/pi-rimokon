import type { CSSProperties } from 'react'
import type { GenUI, Session, ThreadMessage, ToolCall } from './types'
import { TOOL_META, toolIconBg, TOOL_ICON_PATH, type IconName } from './theme'

// ---------------------------------------------------------------------------
// Streaming model
//
// The prototype reveals the final agent message progressively against a single
// integer `step` counter that ticks every 130ms. These helpers reproduce that
// reveal deterministically so the UI stays a pure function of (session, step).
// ---------------------------------------------------------------------------

export function streamMax(sess: Session): number {
  const msg = sess.thread[sess.thread.length - 1]
  const tools = (msg.tools || []).length
  const words = (msg.text || '').split(' ').length
  return tools * 5 + Math.ceil(words / 2) + 3
}

export interface ToolView {
  icon: string
  verb: string
  path: string
  meta?: string
  running: boolean
  done: boolean
  iconWrapStyle: CSSProperties
  cardStyle: CSSProperties
  hasDiff: boolean
  diff: DiffLineView[]
}

export interface DiffLineView {
  bg: string
  fg: string
  sign: string
  code: string
  ln: string | number
}

export interface AgentThreadItem {
  kind: 'agent'
  intro: string
  tools: ToolView[]
  text: string
  cursor: boolean
  genui: GenUI | null
  question: boolean
  options: string[]
  reviewCTA: boolean
  reviewLabel: string
}

export interface UserThreadItem {
  kind: 'user'
  text: string
  steer: boolean
}

export type ThreadItem = AgentThreadItem | UserThreadItem

export interface ThreadView {
  items: ThreadItem[]
  working: boolean
  workingLabel: string
}

function diffLineView(d: { t: string; c: string }): DiffLineView {
  const map: Record<string, { bg: string; fg: string; sign: string }> = {
    '+': { bg: '#e9f5ee', fg: '#1c6b44', sign: '+' },
    '-': { bg: '#fbeae5', fg: '#a8331f', sign: '−' },
    ' ': { bg: 'transparent', fg: '#6b6862', sign: ' ' },
    '@': { bg: '#f1edfb', fg: '#6a4cc0', sign: '' },
  }
  const m = map[d.t] ?? map[' ']
  return { bg: m.bg, fg: m.fg, sign: m.sign, code: d.c, ln: '' }
}

function buildTool(t: ToolCall, running: boolean): ToolView {
  const meta = TOOL_META[t.kind] ?? TOOL_META.read
  const done = !running
  return {
    icon: TOOL_ICON_PATH[meta.icon as IconName],
    verb: meta.verb,
    path: t.path,
    meta: t.meta,
    running,
    done,
    iconWrapStyle: {
      width: 24,
      height: 24,
      flex: 'none',
      borderRadius: 7,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: meta.color,
      background: toolIconBg(meta.color),
    },
    cardStyle: {
      border: `1px solid ${running ? '#e7d3ad' : '#e6e2d6'}`,
      borderRadius: 11,
      background: running ? '#fdf9f0' : '#fff',
      overflow: 'hidden',
    },
    hasDiff: !!t.diff && done,
    diff: (t.diff || []).map(diffLineView),
  }
}

/**
 * Build the renderable thread for a session at a given stream `step`.
 * `live` reflects whether the session is still an actively streaming instance.
 */
export function buildThreadView(sess: Session, step: number): ThreadView {
  const live = !!sess.live
  const lastIdx = sess.thread.length - 1
  const items: ThreadItem[] = []
  let working = false
  let workingLabel = ''

  sess.thread.forEach((m: ThreadMessage, mi) => {
    if (m.role === 'user') {
      items.push({ kind: 'user', text: m.text || '', steer: !!m.steer })
      return
    }

    const tools = m.tools || []
    const T = tools.length
    const isStream = live && !!m.streaming && mi === lastIdx
    let visCount = T
    let runIdx = -1
    let textShown = m.text || ''
    let cursor = false
    let msgWorking = false

    if (isStream) {
      const textStart = T * 5
      const words = (m.text || '').split(' ')
      if (step < textStart) {
        visCount = Math.min(T, Math.floor(step / 5) + 1)
        runIdx = visCount - 1
        textShown = ''
      } else {
        const rw = Math.min(words.length, (step - textStart) * 2)
        textShown = words.slice(0, rw).join(' ')
        cursor = rw < words.length
      }
      const max = streamMax(sess)
      msgWorking = step < max
      if (msgWorking) {
        const rt = tools[runIdx]
        if (rt) {
          const meta = TOOL_META[rt.kind]
          workingLabel = (meta ? meta.verb + 'ing ' : '') + rt.path
        } else {
          workingLabel = 'Composing response…'
        }
      }
    }

    const dispTools = tools
      .slice(0, visCount)
      .map((t, ti) => buildTool(t, isStream && ti === runIdx && msgWorking))

    const reviewCTA =
      mi === lastIdx && !msgWorking && !isStream && sess.add + sess.del > 0 && sess.status !== 'done'
    const liveReviewCTA = mi === lastIdx && isStream && !msgWorking && sess.add + sess.del > 0

    const genui = m.genui && !isStream ? m.genui : null

    items.push({
      kind: 'agent',
      intro: m.intro || '',
      tools: dispTools,
      text: textShown,
      cursor,
      genui,
      question: !!m.question,
      options: m.options || [],
      reviewCTA: reviewCTA || liveReviewCTA,
      reviewLabel: `${sess.changes.length} files changed · +${sess.add} −${sess.del}`,
    })
  })

  working =
    live && step < streamMax(sess) && sess.status !== 'review' && sess.status !== 'done' && sess.status !== 'waiting' && sess.status !== 'error'
  if (sess.status === 'working' && !live) {
    working = true
    workingLabel = sess.latest
  }

  return { items, working, workingLabel: workingLabel || 'Working…' }
}

// ---------------------------------------------------------------------------
// Generative UI
// ---------------------------------------------------------------------------

export interface ChartBarView {
  val: string
  valColor: string
  label: string
  barStyle: CSSProperties
}

export interface ChartGenUIView {
  type: 'chart'
  title: string
  tag: string
  note: string
  bars: ChartBarView[]
}

export interface PreviewGenUIView {
  type: 'preview'
  title: string
  tag: string
  dark: boolean
  paneStyle: CSSProperties
  headingStyle: CSSProperties
  sectionLabelStyle: CSSProperties
  rowStyle: CSSProperties
  row2Style: CSSProperties
  subStyle: CSSProperties
  trackStyle: CSSProperties
  knobStyle: CSSProperties
  trackOffStyle: CSSProperties
  knobOffStyle: CSSProperties
}

export type GenUIView = ChartGenUIView | PreviewGenUIView

export function buildGenUI(g: GenUI, dark: boolean): GenUIView | null {
  if (g.type === 'chart' && g.series) {
    const maxV = Math.max(...g.series.map((p) => p.v))
    return {
      type: 'chart',
      title: g.title,
      tag: g.unit ? 'values in ' + g.unit : '',
      note: g.note || '',
      bars: g.series.map((p) => ({
        val: '' + p.v,
        valColor: p.spike ? '#c0432f' : '#5c594f',
        label: p.t,
        barStyle: {
          width: '100%',
          height: `${Math.max(7, Math.round((p.v / maxV) * 100))}%`,
          borderRadius: '4px 4px 0 0',
          background: p.spike ? '#c0432f' : '#1b1b1d',
          transition: 'height .3s',
        },
      })),
    }
  }

  if (g.type === 'preview') {
    const paneBg = dark ? '#15171c' : '#ffffff'
    const fg = dark ? '#e9ebef' : '#1b1b1d'
    const sub = dark ? '#9097a3' : '#8a8678'
    const border = dark ? '#272b34' : '#ece9e1'
    const rowBd = dark ? '#22262e' : '#f2efe7'
    return {
      type: 'preview',
      title: g.title,
      tag: dark ? 'theme: dark' : 'theme: light',
      dark,
      paneStyle: {
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: '15px 16px 5px',
        background: paneBg,
        color: fg,
        transition: 'background .25s, color .25s, border-color .25s',
      },
      headingStyle: { fontSize: 16, fontWeight: 700, marginBottom: 12, color: fg },
      sectionLabelStyle: {
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 9.5,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: sub,
        marginBottom: 2,
      },
      rowStyle: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 0',
        borderBottom: `1px solid ${rowBd}`,
      },
      row2Style: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' },
      subStyle: { fontSize: 11.5, color: sub, marginTop: 1 },
      trackStyle: {
        width: 42,
        height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        position: 'relative',
        flex: 'none',
        background: dark ? '#1f8a5b' : '#cdc8ba',
        transition: 'background .25s',
      },
      knobStyle: {
        position: 'absolute',
        top: 2,
        left: dark ? 20 : 2,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left .25s',
        boxShadow: '0 1px 2px rgba(0,0,0,.3)',
      },
      trackOffStyle: {
        width: 42,
        height: 24,
        borderRadius: 12,
        position: 'relative',
        flex: 'none',
        background: dark ? '#2a2e37' : '#e2ded3',
      },
      knobOffStyle: {
        position: 'absolute',
        top: 2,
        left: 2,
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: dark ? '#5c6270' : '#fff',
      },
    }
  }

  return null
}

// Active-diff line numbering for the review / work panel diff views.
export function numberDiff(diff: { t: string; c: string }[]): DiffLineView[] {
  let ln = 0
  return diff.map((d) => {
    const dl = diffLineView(d)
    if (d.t === '@' || d.t === '-') {
      dl.ln = ''
    } else {
      dl.ln = ++ln
    }
    return dl
  })
}
