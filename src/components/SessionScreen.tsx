import type { Session } from '../lib/types'
import { dotStyle, pillStyle, statusOf } from '../lib/theme'
import { buildThreadView } from '../lib/sessionView'
import { modelLabel } from '../data/models'
import type { SendMode } from '../hooks/useAppStore'
import { ChevronDown, ChevronLeft, ClockIcon, PanelIcon, TreeIcon } from './icons'
import { ModelMenu } from './ModelMenu'
import { Thread } from './thread/Thread'
import { Composer } from './Composer'

interface SessionScreenProps {
  session: Session
  step: number
  mobile: boolean
  model: string
  modelMenu: boolean
  rightOpen: boolean
  composer: string
  sendMode: SendMode
  queued: string[]
  genuiTheme: 'light' | 'dark'
  onToggleModelMenu: () => void
  onPickModel: (id: string) => void
  onToggleTree: () => void
  onToggleRight: () => void
  onGoHome: () => void
  onComposerChange: (v: string) => void
  onSend: () => void
  onSendMode: (mode: SendMode) => void
  onRemoveQueued: (i: number) => void
  onStop: () => void
  onToggleGenuiTheme: () => void
  onPickOption: (option: string) => void
  onReview: () => void
}

export function SessionScreen(props: SessionScreenProps) {
  const { session, step, mobile } = props
  const st = statusOf(session.status)
  const view = buildThreadView(session, step)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* header */}
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '13px 20px',
          borderBottom: '1px solid var(--pi-border-card)',
          background: 'rgba(244,242,236,.85)',
          backdropFilter: 'blur(6px)',
        }}
      >
        {mobile && (
          <button
            onClick={props.onGoHome}
            style={{ width: 32, height: 32, border: '1px solid var(--pi-border)', borderRadius: 8, background: 'var(--pi-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ChevronLeft size={17} stroke="var(--pi-text)" />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={pillStyle(st)}>
              <span style={dotStyle(st, false)} />
              {st.label}
            </span>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 650, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.title}
            </h2>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--pi-text-faint)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.repo} · {session.branch}
          </div>
        </div>

        {/* model selector */}
        <div style={{ position: 'relative', flex: 'none' }}>
          <button
            className="pi-hover-border"
            onClick={props.onToggleModelMenu}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', border: '1px solid var(--pi-border)', borderRadius: 9, background: 'var(--pi-surface)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}
          >
            <ClockIcon size={14} stroke="var(--pi-green)" strokeWidth={2} />
            {!mobile && <span>{modelLabel(props.model)}</span>}
            <ChevronDown size={13} stroke="var(--pi-text-faint)" />
          </button>
          {props.modelMenu && <ModelMenu model={props.model} onPick={props.onPickModel} />}
        </div>

        <button
          className="pi-hover-border"
          onClick={props.onToggleTree}
          title="Session tree"
          style={{ width: 34, height: 34, flex: 'none', border: '1px solid var(--pi-border)', borderRadius: 9, background: 'var(--pi-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <TreeIcon size={17} stroke="var(--pi-text-soft)" />
        </button>
        <button
          className="pi-hover-border"
          onClick={props.onToggleRight}
          title="Work panel"
          style={{
            width: 34,
            height: 34,
            flex: 'none',
            border: '1px solid var(--pi-border)',
            borderRadius: 9,
            background: props.rightOpen ? 'var(--pi-ink-surface)' : 'var(--pi-surface)',
            color: props.rightOpen ? 'var(--pi-on-ink)' : 'var(--pi-text-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <PanelIcon size={17} />
        </button>
      </div>

      {/* conversation */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Thread
          items={view.items}
          genuiTheme={props.genuiTheme}
          onToggleGenuiTheme={props.onToggleGenuiTheme}
          onPickOption={props.onPickOption}
          onReview={props.onReview}
        />
      </div>

      <Composer
        working={view.working}
        workingLabel={view.workingLabel}
        composer={props.composer}
        sendMode={props.sendMode}
        queued={props.queued}
        onComposerChange={props.onComposerChange}
        onSend={props.onSend}
        onSendMode={props.onSendMode}
        onRemoveQueued={props.onRemoveQueued}
        onStop={props.onStop}
      />
    </div>
  )
}
