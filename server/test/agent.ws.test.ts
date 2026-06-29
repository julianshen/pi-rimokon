import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { SessionHub } from '../src/broker/registry.ts'
import { agentSessions } from '../src/db/repositories.ts'
import { attachAgentServer } from '../src/ws/attach.ts'
import { issueAgentAccess, makeHarness } from './helpers.ts'

let server: Server | undefined

afterEach(async () => {
  if (server) await new Promise<void>((r) => server!.close(() => r()))
  server = undefined
})

async function boot(h: Awaited<ReturnType<typeof makeHarness>>, hub: SessionHub): Promise<string> {
  server = createServer()
  attachAgentServer(server, h.ctx, hub, { handshakeMs: 2000, heartbeatMs: 5000 })
  await new Promise<void>((resolve) => server!.listen(0, resolve))
  return `ws://127.0.0.1:${(server!.address() as AddressInfo).port}/agent`
}

describe('/agent over a real WebSocket', () => {
  it('completes the upgrade + hello/ready handshake and records the session', async () => {
    const h = await makeHarness()
    const hub = new SessionHub()
    const { token } = await issueAgentAccess(h)
    const url = await boot(h, hub)

    const ws = new WebSocket(url, 'pi.rpc.v1', { headers: { Authorization: `Bearer ${token}` } })
    const frames: Array<Record<string, unknown>> = []
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () =>
        ws.send(JSON.stringify({ type: 'hello', id: 'h1', protocol: 'pi.rpc/1', accept_task: true })),
      )
      ws.on('message', (d) => {
        frames.push(JSON.parse(d.toString()))
        if (frames.length >= 2) resolve()
      })
      ws.on('error', reject)
    })

    expect(frames[0]).toMatchObject({ type: 'response', command: 'hello', success: true })
    expect(frames[1]).toMatchObject({ type: 'ready' })
    const sessionId = (frames[0].data as { session_id: string }).session_id
    expect(await agentSessions.findById(h.ctx.db, sessionId)).toMatchObject({ status: 'started' })

    ws.close()
  })

  it('closes the socket with 4401 for a bad token', async () => {
    const h = await makeHarness()
    const url = await boot(h, new SessionHub())

    const ws = new WebSocket(url, { headers: { Authorization: 'Bearer garbage' } })
    const code = await new Promise<number>((resolve, reject) => {
      ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', protocol: 'pi.rpc/1' })))
      ws.on('close', (c) => resolve(c))
      ws.on('error', reject)
    })
    expect(code).toBe(4401)
  })
})
