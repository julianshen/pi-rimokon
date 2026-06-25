import type { KeyboardEvent } from 'react'
import type { SendMode } from '../hooks/useAppStore'
import { ArrowRight, CloseIcon, QueueIcon } from './icons'

interface ComposerProps {
  working: boolean
  workingLabel: string
  composer: string
  sendMode: SendMode
  queued: string[]
  onComposerChange: (value: string) => void
  onSend: () => void
  onSendMode: (mode: SendMode) => void
  onRemoveQueued: (index: number) => void
  onStop: () => void
}

function segStyle(active: boolean): React.CSSProperties {
  return {
    padding: '5px 11px',
    border: 'none',
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? '#fff' : 'transparent',
    color: active ? '#1b1b1d' : '#8a8678',
    boxShadow: active ? '0 1px 2px rgba(40,36,28,.12)' : 'none',
  }
}

export function Composer({
  working,
  workingLabel,
  composer,
  sendMode,
  queued,
  onComposerChange,
  onSend,
  onSendMode,
  onRemoveQueued,
  onStop,
}: ComposerProps) {
  const sendLabel = sendMode === 'follow' ? 'Queue' : working ? 'Steer' : 'Send'
  const composerHint = sendMode === 'follow' ? '↵ queue · ⇧↵ newline' : '↵ steer · ⌥↵ queue · ⇧↵ newline'
  const placeholder = working ? 'Steer the agent while it works…' : 'Reply to Pi, or start a follow-up…'

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // ⌥↵ always queues; otherwise honor the active mode.
      onSendMode(e.altKey ? 'follow' : sendMode)
      onSend()
    }
  }

  return (
    <div style={{ flex: 'none', padding: '0 22px 16px' }}>
      <div style={{ maxWidth: 756, margin: '0 auto' }}>
        {working && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 14px',
              marginBottom: 9,
              background: '#1b1b1d',
              borderRadius: 11,
              color: '#f4f2ec',
              animation: 'pi-rise .2s ease',
            }}
          >
            <span style={{ display: 'inline-flex', gap: 3 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#9fe3bd', animation: 'pi-bob 1s infinite' }} />
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#9fe3bd', animation: 'pi-bob 1s .2s infinite' }} />
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#9fe3bd', animation: 'pi-bob 1s .4s infinite' }} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {workingLabel}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#9b9788' }}>↵ to steer</span>
            <button
              onClick={onStop}
              className="pi-hover-stop"
              style={{
                padding: '5px 10px',
                border: '1px solid #3a3a3d',
                borderRadius: 7,
                background: 'transparent',
                color: '#f4f2ec',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono',monospace",
              }}
            >
              Stop
            </button>
          </div>
        )}

        {queued.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 9 }}>
            {queued.map((q, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '6px 8px 6px 11px',
                  background: '#f6ecdb',
                  border: '1px solid #e7d3ad',
                  borderRadius: 9,
                  fontSize: 12.5,
                  color: '#7a5417',
                  maxWidth: 340,
                }}
              >
                <QueueIcon size={12} style={{ flex: 'none' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q}</span>
                <button onClick={() => onRemoveQueued(i)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#a98a4e', display: 'flex', padding: 0 }}>
                  <CloseIcon size={13} strokeWidth={2.2} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #d8d4c9', borderRadius: 14, padding: '12px 14px 10px', boxShadow: '0 2px 12px rgba(40,36,28,.05)' }}>
          <textarea
            value={composer}
            onChange={(e) => onComposerChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={1}
            style={{
              width: '100%',
              border: 'none',
              resize: 'none',
              fontSize: 14.5,
              lineHeight: 1.55,
              color: '#1b1b1d',
              background: 'transparent',
              minHeight: 24,
              maxHeight: 160,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <div style={{ display: 'inline-flex', background: '#f0ede4', borderRadius: 9, padding: 2 }}>
              <button onClick={() => onSendMode('steer')} style={segStyle(sendMode === 'steer')}>
                Steer
              </button>
              <button onClick={() => onSendMode('follow')} style={segStyle(sendMode === 'follow')}>
                Follow-up
              </button>
            </div>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: '#9b9788' }}>{composerHint}</span>
            <div style={{ flex: 1 }} />
            <button
              className="pi-hover-opacity"
              onClick={onSend}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                border: 'none',
                borderRadius: 9,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                background: sendMode === 'follow' ? '#b9772a' : '#1b1b1d',
                color: '#fff',
              }}
            >
              {sendLabel}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
