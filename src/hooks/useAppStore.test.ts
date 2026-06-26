import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAppStore } from './useAppStore'
import { streamMax } from '../lib/sessionView'
import { MockPiService } from '../services/MockPiService'
import { SEED_SESSIONS } from '../data/seedSessions'

// SEED_SESSIONS is a shared, mutable module singleton: MockPiService hands out
// references to these objects, and actions like stopRun/sendMessage mutate them
// in place. Snapshot a pristine copy and restore it before every test so the
// seeds (e.g. s1.live) stay deterministic regardless of test order.
const PRISTINE_SEEDS = structuredClone(SEED_SESSIONS)
function restoreSeeds() {
  SEED_SESSIONS.splice(0, SEED_SESSIONS.length, ...structuredClone(PRISTINE_SEEDS))
}

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
}

function renderStore() {
  const service = new MockPiService()
  const hook = renderHook(() => useAppStore(service))
  return { service, ...hook }
}

describe('useAppStore', () => {
  beforeEach(() => {
    restoreSeeds()
    setViewport(1280)
  })

  describe('initial state', () => {
    it('starts on the home route with the seeded sessions and the s1 active session', () => {
      const { result } = renderStore()
      expect(result.current.state.route).toBe('home')
      expect(result.current.state.activeId).toBe('s1')
      expect(result.current.sessions.length).toBeGreaterThan(0)
      expect(result.current.activeSession?.id).toBe('s1')
      expect(result.current.mobile).toBe(false)
    })
  })

  describe('patch', () => {
    it('shallow-merges an object patch', () => {
      const { result } = renderStore()
      act(() => result.current.patch({ rightOpen: true, rightTab: 'diff' }))
      expect(result.current.state.rightOpen).toBe(true)
      expect(result.current.state.rightTab).toBe('diff')
    })

    it('supports a functional patch', () => {
      const { result } = renderStore()
      act(() => result.current.patch({ queued: ['a'] }))
      act(() => result.current.patch((s) => ({ queued: [...s.queued, 'b'] })))
      expect(result.current.state.queued).toEqual(['a', 'b'])
    })
  })

  describe('navigation actions', () => {
    it('openSession switches to the session route and resets the per-session UI', () => {
      const { result } = renderStore()
      act(() => result.current.patch({ queued: ['x'], composer: 'draft', rightOpen: true, step: 9 }))
      act(() => result.current.actions.openSession('s2'))
      expect(result.current.state.route).toBe('session')
      expect(result.current.state.activeId).toBe('s2')
      expect(result.current.state.step).toBe(0)
      expect(result.current.state.queued).toEqual([])
      expect(result.current.state.composer).toBe('')
      expect(result.current.state.rightOpen).toBe(false)
      expect(result.current.activeSession?.id).toBe('s2')
    })

    it('goHome / goSettings / goCompose / goReview / backToSession set the route and close menus', () => {
      const { result } = renderStore()
      act(() => result.current.patch({ mobileNav: true, modelMenu: true, repoMenu: true }))
      act(() => result.current.actions.goSettings())
      expect(result.current.state.route).toBe('settings')
      expect(result.current.state.mobileNav).toBe(false)
      expect(result.current.state.modelMenu).toBe(false)
      expect(result.current.state.repoMenu).toBe(false)

      act(() => result.current.actions.goCompose())
      expect(result.current.state.route).toBe('compose')
      act(() => result.current.actions.goReview())
      expect(result.current.state.route).toBe('review')
      act(() => result.current.actions.backToSession())
      expect(result.current.state.route).toBe('session')
      act(() => result.current.actions.goHome())
      expect(result.current.state.route).toBe('home')
    })
  })

  describe('doSend', () => {
    it('does nothing when the composer is blank', () => {
      const { result, service } = renderStore()
      const spy = vi.spyOn(service, 'sendMessage')
      act(() => result.current.patch({ activeId: 's1', composer: '   ' }))
      act(() => result.current.actions.doSend('steer'))
      expect(spy).not.toHaveBeenCalled()
    })

    it('does nothing when there is no active session', () => {
      const { result, service } = renderStore()
      const spy = vi.spyOn(service, 'sendMessage')
      act(() => result.current.patch({ activeId: 'missing', composer: 'hi' }))
      act(() => result.current.actions.doSend('steer'))
      expect(spy).not.toHaveBeenCalled()
    })

    it('in follow mode it queues the text and clears the composer (no service call)', () => {
      const { result, service } = renderStore()
      const spy = vi.spyOn(service, 'sendMessage')
      act(() => result.current.patch({ activeId: 's1', composer: 'later please' }))
      act(() => result.current.actions.doSend('follow'))
      expect(result.current.state.queued).toEqual(['later please'])
      expect(result.current.state.composer).toBe('')
      expect(spy).not.toHaveBeenCalled()
    })

    it('in steer mode on a live session below streamMax it steers (steer=true)', () => {
      const { result, service } = renderStore()
      const spy = vi.spyOn(service, 'sendMessage')
      // s1 is live; step 0 < streamMax so this is a steer
      act(() => result.current.actions.openSession('s1'))
      act(() => result.current.patch({ composer: 'steer it' }))
      act(() => result.current.actions.doSend('steer'))
      expect(spy).toHaveBeenCalledWith('s1', 'steer it', { steer: true })
      expect(result.current.state.composer).toBe('')
    })

    it('in steer mode past streamMax (or non-live) it sends a fresh turn (steer=false)', () => {
      const { result, service } = renderStore()
      const spy = vi.spyOn(service, 'sendMessage')
      act(() => result.current.actions.openSession('s1'))
      const max = streamMax(service.getSession('s1')!)
      act(() => result.current.patch({ step: max, composer: 'new turn' }))
      act(() => result.current.actions.doSend('steer'))
      expect(spy).toHaveBeenCalledWith('s1', 'new turn', { steer: false })
    })

    it('a non-live session always sends steer=false', () => {
      const { result, service } = renderStore()
      const spy = vi.spyOn(service, 'sendMessage')
      // s2 is a review session (not live)
      act(() => result.current.actions.openSession('s2'))
      act(() => result.current.patch({ composer: 'comment' }))
      act(() => result.current.actions.doSend('steer'))
      expect(spy).toHaveBeenCalledWith('s2', 'comment', { steer: false })
    })
  })

  describe('stopRun', () => {
    it('stops the live run and pins step to streamMax', () => {
      const { result, service } = renderStore()
      const spy = vi.spyOn(service, 'stopRun')
      act(() => result.current.actions.openSession('s1'))
      const max = streamMax(service.getSession('s1')!)
      act(() => result.current.actions.stopRun())
      expect(spy).toHaveBeenCalledWith('s1')
      expect(result.current.state.step).toBe(max)
      expect(service.getSession('s1')!.live).toBe(false)
    })

    it('does nothing when there is no active session', () => {
      const { result, service } = renderStore()
      const spy = vi.spyOn(service, 'stopRun')
      act(() => result.current.patch({ activeId: 'missing' }))
      act(() => result.current.actions.stopRun())
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('startTask', () => {
    it('creates a session from the compose fields and opens it', () => {
      const { result, service } = renderStore()
      const spy = vi.spyOn(service, 'startSession')
      act(() =>
        result.current.patch({
          composeText: 'Build a thing',
          composeRepo: 'acme/payments-api',
          model: 'gpt5',
          skills: { tests: true, lint: true },
        }),
      )
      act(() => result.current.actions.startTask())
      expect(spy).toHaveBeenCalledWith({
        prompt: 'Build a thing',
        repo: 'acme/payments-api',
        model: 'gpt5',
        skills: { tests: true, lint: true },
      })
      // navigates into the new session
      expect(result.current.state.route).toBe('session')
      expect(result.current.activeSession?.title).toBe('Build a thing')
      expect(result.current.activeSession?.repo).toBe('acme/payments-api')
    })
  })

  describe('pickOption', () => {
    it('forwards the chosen option to the service for the active session', () => {
      const { result, service } = renderStore()
      const spy = vi.spyOn(service, 'pickOption')
      act(() => result.current.actions.openSession('s5'))
      act(() => result.current.actions.pickOption('Staging too'))
      expect(spy).toHaveBeenCalledWith('s5', 'Staging too')
    })

    it('does nothing when the active session is missing', () => {
      const { result, service } = renderStore()
      const spy = vi.spyOn(service, 'pickOption')
      act(() => result.current.patch({ activeId: 'missing' }))
      act(() => result.current.actions.pickOption('x'))
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('service subscription', () => {
    it('re-renders when the service mutates (sendMessage appends a turn)', () => {
      const { result, service } = renderStore()
      const before = service.getSession('s1')!.thread.length
      act(() => {
        service.sendMessage('s1', 'hello', { steer: false })
      })
      // the store re-rendered and exposes the mutated session
      expect(result.current.activeSession!.thread.length).toBe(before + 1)
    })
  })

  describe('responsive mobile flag', () => {
    it('is false on a wide viewport and true once below the breakpoint', () => {
      const { result } = renderStore()
      expect(result.current.mobile).toBe(false)
      act(() => {
        setViewport(500)
        window.dispatchEvent(new Event('resize'))
      })
      expect(result.current.state.vw).toBe(500)
      expect(result.current.mobile).toBe(true)
    })

    it('stays desktop exactly at the breakpoint (860 is not < 860)', () => {
      const { result } = renderStore()
      act(() => {
        setViewport(860)
        window.dispatchEvent(new Event('resize'))
      })
      expect(result.current.mobile).toBe(false)
      act(() => {
        setViewport(859)
        window.dispatchEvent(new Event('resize'))
      })
      expect(result.current.mobile).toBe(true)
    })
  })

  describe('streaming clock effect', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('advances step while on a live session below streamMax', () => {
      const service = new MockPiService()
      const { result } = renderHook(() => useAppStore(service))
      act(() => result.current.actions.openSession('s1'))
      expect(result.current.state.step).toBe(0)
      act(() => {
        vi.advanceTimersByTime(130)
      })
      expect(result.current.state.step).toBe(1)
      act(() => {
        vi.advanceTimersByTime(130 * 3)
      })
      expect(result.current.state.step).toBe(4)
    })

    it('does not advance step when not on the session route', () => {
      const service = new MockPiService()
      const { result } = renderHook(() => useAppStore(service))
      // stay on 'home'
      act(() => {
        vi.advanceTimersByTime(130 * 5)
      })
      expect(result.current.state.step).toBe(0)
    })

    it('does not advance step for a non-live session', () => {
      const service = new MockPiService()
      const { result } = renderHook(() => useAppStore(service))
      act(() => result.current.actions.openSession('s4')) // done, not live
      act(() => {
        vi.advanceTimersByTime(130 * 5)
      })
      expect(result.current.state.step).toBe(0)
    })

    it('stops advancing once step reaches streamMax', () => {
      const service = new MockPiService()
      const { result } = renderHook(() => useAppStore(service))
      act(() => result.current.actions.openSession('s1'))
      const max = streamMax(service.getSession('s1')!)
      act(() => result.current.patch({ step: max }))
      act(() => {
        vi.advanceTimersByTime(130 * 4)
      })
      expect(result.current.state.step).toBe(max)
    })
  })
})
