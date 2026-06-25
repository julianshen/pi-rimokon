import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MockPiService } from './MockPiService'
import { SEED_SESSIONS } from '../data/seedSessions'

describe('MockPiService', () => {
  let svc: MockPiService

  beforeEach(() => {
    svc = new MockPiService()
  })

  describe('listSessions', () => {
    it('returns the seed sessions when nothing has been created', () => {
      const list = svc.listSessions()
      expect(list).toHaveLength(SEED_SESSIONS.length)
      expect(list.map((s) => s.id)).toEqual(SEED_SESSIONS.map((s) => s.id))
    })

    it('prepends newly created sessions ahead of the seed list', () => {
      const created = svc.startSession({ prompt: 'New task', repo: 'acme/web-app', model: 'sonnet', skills: {} })
      const list = svc.listSessions()
      expect(list).toHaveLength(SEED_SESSIONS.length + 1)
      expect(list[0]).toBe(created)
      // seed sessions still present after the created one
      expect(list[1].id).toBe(SEED_SESSIONS[0].id)
    })
  })

  describe('getSession', () => {
    it('finds a seeded session by id (hit)', () => {
      const s = svc.getSession('s1')
      expect(s).toBeDefined()
      expect(s?.title).toBe('Add rate limiting to login endpoint')
    })

    it('returns undefined for an unknown id (miss)', () => {
      expect(svc.getSession('does-not-exist')).toBeUndefined()
    })

    it('finds a freshly created session by id', () => {
      const created = svc.startSession({ prompt: 'Hello', repo: 'acme/web-app', model: 'gpt5', skills: {} })
      expect(svc.getSession(created.id)).toBe(created)
    })
  })

  describe('startSession', () => {
    it('creates a session from the prompt and returns it', () => {
      const sess = svc.startSession({ prompt: 'Add a feature flag', repo: 'acme/payments-api', model: 'sonnet', skills: { tests: true } })
      expect(sess.id).toBe('c1')
      expect(sess.title).toBe('Add a feature flag')
      expect(sess.repo).toBe('acme/payments-api')
      expect(sess.model).toBe('sonnet')
      expect(sess.status).toBe('working')
      expect(sess.live).toBe(true)
      expect(sess.branch).toBe('pi/add-a-feature-flag')
      expect(sess.thread).toHaveLength(2)
      expect(sess.thread[0]).toMatchObject({ role: 'user', text: 'Add a feature flag' })
      expect(sess.thread[1].role).toBe('agent')
      expect(sess.changes.length).toBeGreaterThan(0)
      expect(sess.terminal.length).toBeGreaterThan(0)
      expect(sess.tree.length).toBeGreaterThan(0)
    })

    it('falls back to a default prompt when the prompt is blank', () => {
      const sess = svc.startSession({ prompt: '   ', repo: 'acme/web-app', model: 'sonnet', skills: {} })
      expect(sess.thread[0].text).toBe('Implement the requested change')
      expect(sess.title).toBe('Implement the requested change')
    })

    it('truncates a long title with an ellipsis', () => {
      const long = 'x'.repeat(80)
      const sess = svc.startSession({ prompt: long, repo: 'acme/web-app', model: 'sonnet', skills: {} })
      expect(sess.title.endsWith('…')).toBe(true)
      // 52 chars + ellipsis
      expect(sess.title).toHaveLength(53)
    })

    it('increments ids as more sessions are created', () => {
      const a = svc.startSession({ prompt: 'A', repo: 'r', model: 'm', skills: {} })
      const b = svc.startSession({ prompt: 'B', repo: 'r', model: 'm', skills: {} })
      expect(a.id).toBe('c1')
      expect(b.id).toBe('c2')
    })

    it('notifies subscribers when a session is created', () => {
      const listener = vi.fn()
      svc.subscribe(listener)
      svc.startSession({ prompt: 'A', repo: 'r', model: 'm', skills: {} })
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('sendMessage', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
    })

    it('does nothing for an unknown session id', () => {
      const listener = vi.fn()
      svc.subscribe(listener)
      svc.sendMessage('nope', 'hi', { steer: false })
      expect(listener).not.toHaveBeenCalled()
    })

    it('appends a user turn immediately and the agent reply after the timer (steer=false)', () => {
      const listener = vi.fn()
      svc.subscribe(listener)
      const before = svc.getSession('s1')!.thread.length
      svc.sendMessage('s1', 'please continue', { steer: false })

      const sess = svc.getSession('s1')!
      expect(sess.thread).toHaveLength(before + 1)
      expect(sess.thread[sess.thread.length - 1]).toMatchObject({ role: 'user', text: 'please continue', steer: false })
      expect(listener).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(850)
      const after = svc.getSession('s1')!
      expect(after.thread).toHaveLength(before + 2)
      const reply = after.thread[after.thread.length - 1]
      expect(reply.role).toBe('agent')
      expect(reply.intro).toBe('On it.')
      expect(listener).toHaveBeenCalledTimes(2)
    })

    it('uses the steer acknowledgement when steer=true', () => {
      svc.sendMessage('s1', 'also handle X', { steer: true })
      const sess = svc.getSession('s1')!
      expect(sess.thread[sess.thread.length - 1]).toMatchObject({ role: 'user', text: 'also handle X', steer: true })

      vi.runOnlyPendingTimers()
      const reply = svc.getSession('s1')!.thread.slice(-1)[0]
      expect(reply.role).toBe('agent')
      expect(reply.intro).toBe('Got it — folding that into the current run.')
    })

    it('does not fire the agent reply before the timer elapses', () => {
      const before = svc.getSession('s1')!.thread.length
      svc.sendMessage('s1', 'hi', { steer: false })
      vi.advanceTimersByTime(800)
      // still only the user turn appended
      expect(svc.getSession('s1')!.thread).toHaveLength(before + 1)
    })
  })

  describe('pickOption', () => {
    it('appends the chosen option as a user turn and notifies', () => {
      const listener = vi.fn()
      svc.subscribe(listener)
      const before = svc.getSession('s5')!.thread.length
      svc.pickOption('s5', 'Staging too')
      const sess = svc.getSession('s5')!
      expect(sess.thread).toHaveLength(before + 1)
      expect(sess.thread[sess.thread.length - 1]).toMatchObject({ role: 'user', text: 'Staging too' })
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('does nothing for an unknown session id', () => {
      const listener = vi.fn()
      svc.subscribe(listener)
      svc.pickOption('nope', 'whatever')
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('stopRun', () => {
    it('marks a live session as not live and notifies', () => {
      const listener = vi.fn()
      svc.subscribe(listener)
      expect(svc.getSession('s1')!.live).toBe(true)
      svc.stopRun('s1')
      expect(svc.getSession('s1')!.live).toBe(false)
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('does nothing for an unknown session id', () => {
      const listener = vi.fn()
      svc.subscribe(listener)
      svc.stopRun('nope')
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('subscribe', () => {
    it('fires the listener on a mutation and stops after unsubscribe', () => {
      const listener = vi.fn()
      const unsub = svc.subscribe(listener)
      svc.stopRun('s1')
      expect(listener).toHaveBeenCalledTimes(1)

      unsub()
      svc.stopRun('s2')
      // no further calls after unsubscribe
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('supports multiple independent listeners', () => {
      const a = vi.fn()
      const b = vi.fn()
      svc.subscribe(a)
      const unsubB = svc.subscribe(b)
      svc.stopRun('s1')
      expect(a).toHaveBeenCalledTimes(1)
      expect(b).toHaveBeenCalledTimes(1)
      unsubB()
      svc.stopRun('s2')
      expect(a).toHaveBeenCalledTimes(2)
      expect(b).toHaveBeenCalledTimes(1)
    })
  })
})
