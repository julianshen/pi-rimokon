import { basename } from 'node:path'
import { ensureToken, fileCredentialStore } from './src/auth.ts'
import { loadConfig } from './src/config.ts'
import { type Availability, type ConnStatus, RemoteConnection } from './src/connection.ts'
import type { CommandFrame } from './src/protocol.ts'

// --- Minimal structural view of Pi's ExtensionAPI (see pi.dev/docs/extensions).
// Declared locally so the extension typechecks without the SDK installed; at
// runtime Pi passes the real object, which is a superset of this.
interface PiCtx {
  ui: {
    notify(message: string, level?: 'info' | 'warn' | 'error'): void
    setStatus(key: string, text: string): void
  }
  mode?: string
  cwd: string
  isIdle(): boolean
  abort(): void
}
interface PiEvent {
  [k: string]: unknown
}
interface ExtensionAPI {
  registerCommand(
    name: string,
    opts: {
      description: string
      handler: (args: string, ctx: PiCtx) => void | Promise<void>
      getArgumentCompletions?: (prefix: string) => string[]
    },
  ): void
  on(event: string, handler: (event: PiEvent, ctx: PiCtx) => void | Promise<void>): void
  sendUserMessage(text: string, opts?: { deliverAs?: 'steer' | 'followUp' | 'nextTurn' }): void
}

/** Best-effort text extraction from a Pi message (shape varies by version). */
function messageText(m: unknown): string | undefined {
  const msg = m as { text?: unknown; content?: unknown }
  if (typeof msg?.text === 'string') return msg.text
  if (typeof msg?.content === 'string') return msg.content
  if (Array.isArray(msg?.content)) {
    return (msg.content as Array<{ text?: string }>).map((p) => (typeof p === 'string' ? p : (p?.text ?? ''))).join('')
  }
  return undefined
}

export default function remoteControl(pi: ExtensionAPI): void {
  let conn: RemoteConnection | null = null
  // The most recent context — used to abort the in-flight run on a browser "stop".
  let lastCtx: PiCtx | null = null

  const availability = (ctx: PiCtx): Availability => ({
    mode: ctx.mode,
    state: ctx.isIdle() ? 'idle' : 'busy',
    cwd: ctx.cwd,
    repo: basename(ctx.cwd || '') || undefined,
    acceptTask: true,
  })

  function handleCommand(frame: CommandFrame, reply: (p: Record<string, unknown>) => void): void {
    const text = typeof frame.message === 'string' ? frame.message : ''
    switch (frame.type) {
      case 'prompt':
        pi.sendUserMessage(text)
        reply({ success: true })
        break
      case 'steer':
        pi.sendUserMessage(text, { deliverAs: 'steer' })
        reply({ success: true })
        break
      case 'pick_option':
        pi.sendUserMessage(String(frame.option ?? ''))
        reply({ success: true })
        break
      case 'stop':
        lastCtx?.abort()
        reply({ success: true })
        break
      default:
        reply({ success: false, error: 'unsupported_command' })
    }
  }

  function updateStatus(ctx: PiCtx, s: ConnStatus): void {
    if (s.state === 'ready') ctx.ui.setStatus('remote-control', '🔗 Pi Remote: connected')
    else if (s.state === 'reconnecting') ctx.ui.setStatus('remote-control', '… Pi Remote: reconnecting')
    else if (s.state === 'stopped') ctx.ui.setStatus('remote-control', '')
  }

  pi.registerCommand('remote-control', {
    description: 'Connect this session to Pi Remote (optional: /remote-control <wss://host>)',
    getArgumentCompletions: () => [loadConfig().wsUrl],
    handler: (args, ctx) => {
      lastCtx = ctx
      if (conn) {
        ctx.ui.notify('Pi Remote is already connected for this session.', 'info')
        return
      }
      const override = args.trim()
      if (override && !/^wss?:\/\//i.test(override)) {
        ctx.ui.notify('Usage: /remote-control [wss://host] — expected a ws:// or wss:// URL', 'error')
        return
      }
      const cfg = loadConfig(process.env, override || undefined)
      const store = fileCredentialStore(cfg.credentialsPath)
      conn = new RemoteConnection({
        wsUrl: cfg.wsUrl,
        getToken: () =>
          ensureToken({
            httpBase: cfg.httpBase,
            clientId: cfg.clientId,
            store,
            presentCode: (c) => {
              ctx.ui.notify(`Pi Remote — open ${c.verificationUri} and enter code: ${c.userCode}`, 'info')
              ctx.ui.setStatus('remote-control', `Pi Remote: enter ${c.userCode} at ${c.verificationUri}`)
            },
          }),
        availability: () => availability(ctx),
        onCommand: handleCommand,
        onStatus: (s) => updateStatus(ctx, s),
      })
      conn.start()
      ctx.ui.notify(`Pi Remote: connecting to ${cfg.wsUrl}…`, 'info')
    },
  })

  // Session events → events fanned out to the user's browser(s).
  const emit = (frame: Record<string, unknown>) => conn?.sendEvent(frame)

  pi.on('agent_start', (_e, ctx) => {
    lastCtx = ctx
    emit({ type: 'state', state: 'busy' })
  })
  pi.on('agent_end', (_e, ctx) => {
    lastCtx = ctx
    emit({ type: 'state', state: 'idle' })
  })
  pi.on('message_end', (e, ctx) => {
    lastCtx = ctx
    const text = messageText(e.message)
    if (text) emit({ type: 'agent_message', message: text })
  })
  pi.on('tool_execution_start', (e) =>
    emit({ type: 'tool_execution_update', tool: e.toolName, status: 'running', tool_call_id: e.toolCallId }),
  )
  pi.on('tool_execution_end', (e) =>
    emit({ type: 'tool_execution_update', tool: e.toolName, status: 'done', is_error: e.isError, tool_call_id: e.toolCallId }),
  )
  pi.on('session_shutdown', () => {
    conn?.stop()
    conn = null
  })
}
