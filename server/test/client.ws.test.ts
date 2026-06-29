import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { Broker } from '../src/broker/registry.ts'
import { TicketStore } from '../src/broker/tickets.ts'
import { attachWebSockets } from '../src/ws/attach.ts'
import { issueAgentAccess, makeHarness, TEST_USER } from './helpers.ts'

let server: Server | undefined
const open: WebSocket[] = []

afterEach(async () => {
  for (const ws of open.splice(0)) ws.close()
  if (server) await new Promise<void>((r) => server!.close(() => r()))
  server = undefined
})

/** Wait for the next message on a socket that satisfies `match`. */
function next(ws: WebSocket, match: (f: Record<string, unknown>) => boolean): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const onMsg = (d: WebSocket.RawData) => {
      const f = JSON.parse(d.toString())
      if (match(f)) {
        ws.off('message', onMsg)
        resolve(f)
      }
    }
    ws.on('message', onMsg)
    ws.on('error', reject)
  })
}

describe('/client end-to-end', () => {
  it('snapshots, routes a command round-trip, and fans out an event', async () => {
    const h = await makeHarness()
    const broker = new Broker()
    const tickets = new TicketStore(() => h.clock.value, 30)
    server = createServer()
    attachWebSockets(server, h.ctx, broker, { ticketStore: tickets, handshakeMs: 2000, heartbeatMs: 5000 })
    await new Promise<void>((r) => server!.listen(0, r))
    const base = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`

    // 1. agent connects + handshakes
    const { token } = await issueAgentAccess(h)
    const agent = new WebSocket(`${base}/agent`, 'pi.rpc.v1', { headers: { Authorization: `Bearer ${token}` } })
    open.push(agent)
    agent.on('open', () =>
      agent.send(JSON.stringify({ type: 'hello', id: 'h1', protocol: 'pi.rpc/1', accept_task: true, agent: { repo: 'acme/web' } })),
    )
    const ready = await next(agent, (f) => f.type === 'ready')
    const sessionId = ready.session_id as string
    // agent echoes a response for any steer it receives
    agent.on('message', (d) => {
      const f = JSON.parse(d.toString())
      if (f.type === 'steer') agent.send(JSON.stringify({ type: 'response', command: 'steer', id: f.id, success: true }))
    })

    // 2. client gets a ticket + connects
    const { ticket } = tickets.issue(TEST_USER)
    const client = new WebSocket(`${base}/client?ticket=${ticket}`)
    open.push(client)
    const snapshot = await next(client, (f) => f.type === 'sessions')
    expect(snapshot.sessions).toEqual([
      expect.objectContaining({ session_id: sessionId, repo: 'acme/web', state: 'idle' }),
    ])

    // 3. command round-trip: client id 'c1' preserved on the response
    client.send(JSON.stringify({ type: 'steer', id: 'c1', session_id: sessionId, text: 'go' }))
    const resp = await next(client, (f) => f.type === 'response')
    expect(resp).toMatchObject({ command: 'steer', id: 'c1', session_id: sessionId, success: true })

    // 4. event fan-out: server stamps seq, adds session_id
    agent.send(JSON.stringify({ type: 'tool_update', status: 'running' }))
    const evt = await next(client, (f) => f.type === 'tool_update')
    expect(evt).toMatchObject({ type: 'tool_update', status: 'running', session_id: sessionId, seq: 1 })
  })

  it('rejects a /client upgrade with a bad ticket', async () => {
    const h = await makeHarness()
    const broker = new Broker()
    const tickets = new TicketStore(() => h.clock.value, 30)
    server = createServer()
    attachWebSockets(server, h.ctx, broker, { ticketStore: tickets })
    await new Promise<void>((r) => server!.listen(0, r))
    const base = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`

    const client = new WebSocket(`${base}/client?ticket=nope`)
    open.push(client)
    const err = await new Promise<Error>((resolve) => client.on('error', resolve))
    expect(err).toBeInstanceOf(Error) // upgrade was rejected (socket destroyed)
  })
})
