import { describe, expect, it } from 'vitest'
import { type AgentSession, SessionHub } from '../src/broker/registry.ts'

function session(over: Partial<AgentSession>): AgentSession {
  const closes: number[] = []
  return {
    sessionId: 'ses_1',
    userId: 'u1',
    jti: 'jti_1',
    familyId: 'fam_1',
    availability: { acceptTask: false },
    socket: { close: (c) => closes.push(c), send: () => {}, ...((over.socket as object) ?? {}) },
    ...over,
  } as AgentSession
}

describe('SessionHub', () => {
  it('registers, gets, and unregisters by id', () => {
    const hub = new SessionHub()
    const s = session({ sessionId: 'ses_a' })
    hub.register(s)
    expect(hub.get('ses_a')).toBe(s)
    hub.unregister('ses_a')
    expect(hub.get('ses_a')).toBeUndefined()
  })

  it('lists a user’s live sessions only', () => {
    const hub = new SessionHub()
    hub.register(session({ sessionId: 'a', userId: 'u1' }))
    hub.register(session({ sessionId: 'b', userId: 'u1' }))
    hub.register(session({ sessionId: 'c', userId: 'u2' }))
    expect(hub.listByUser('u1').map((s) => s.sessionId).sort()).toEqual(['a', 'b'])
    expect(hub.listByUser('u2')).toHaveLength(1)
  })

  it('closes every socket in a revoked family and counts them', () => {
    const hub = new SessionHub()
    const closed: number[] = []
    const mk = (id: string, fam: string) =>
      session({ sessionId: id, familyId: fam, socket: { close: (c) => closed.push(c), send: () => {} } })
    hub.register(mk('a', 'fam_x'))
    hub.register(mk('b', 'fam_x'))
    hub.register(mk('c', 'fam_y'))
    expect(hub.closeFamily('fam_x', 4403)).toBe(2)
    expect(closed).toEqual([4403, 4403])
  })
})
