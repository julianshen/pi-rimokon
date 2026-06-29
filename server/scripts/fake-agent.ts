/**
 * Fake Pi agent — a ~100-line `ws` client that speaks the `/agent` protocol
 * (spec §4) without the real Pi binary. Drives manual + M3–M5 testing.
 *
 * Usage:
 *   tsx scripts/fake-agent.ts <ws-url> <agent-token> [--idle]
 *
 *   <ws-url>       e.g. ws://127.0.0.1:8787/agent
 *   <agent-token>  an access token from the device flow (see README)
 *   --idle         advertise accept_task=true and just wait (for §5.4 selection)
 *
 * Without --idle it emits a couple of demo events after the handshake.
 */
import { WebSocket } from 'ws'
import { PROTOCOL_VERSION, WS_SUBPROTOCOL } from '../../shared/protocol.ts'

const [, , url, token, ...flags] = process.argv
if (!url || !token) {
  console.error('usage: tsx scripts/fake-agent.ts <ws-url> <agent-token> [--idle]')
  process.exit(1)
}
const idle = flags.includes('--idle')

const ws = new WebSocket(url, WS_SUBPROTOCOL, { headers: { Authorization: `Bearer ${token}` } })
let seq = 0

ws.on('open', () => {
  log('open → hello')
  send({
    type: 'hello',
    id: 'h1',
    protocol: PROTOCOL_VERSION,
    mode: 'code',
    state: 'idle',
    cwd: process.cwd(),
    accept_task: idle,
    agent: { name: 'fake-pi', version: '0.0.0', repo: 'acme/web-app', capabilities: ['tools'] },
  })
})

ws.on('message', (data) => {
  const frame = JSON.parse(data.toString())
  log(`recv ${frame.type}${frame.command ? `:${frame.command}` : ''}`)
  if (frame.type === 'ready' && !idle) {
    send({ type: 'tool_execution_update', seq: ++seq, tool: 'shell', status: 'running' })
    send({ type: 'tool_execution_update', seq: ++seq, tool: 'shell', status: 'done' })
  }
})

ws.on('close', (code) => {
  log(`closed (${code})`)
  process.exit(0)
})
ws.on('error', (err) => {
  console.error('[fake-agent] error', err)
  process.exit(1)
})

function send(obj: unknown): void {
  ws.send(JSON.stringify(obj))
}
function log(msg: string): void {
  console.log(`[fake-agent] ${msg}`)
}
