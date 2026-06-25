import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PiService } from '../services/PiService'
import { streamMax } from '../lib/sessionView'
import type { Session } from '../lib/types'

export type Route = 'home' | 'session' | 'review' | 'compose' | 'settings'
export type SendMode = 'steer' | 'follow'
export type RightTab = 'files' | 'diff' | 'terminal'

const MOBILE_BREAKPOINT = 860
const STREAM_TICK_MS = 130

interface UIState {
  route: Route
  activeId: string
  step: number
  rightOpen: boolean
  rightTab: RightTab
  diffIndex: number
  treeOpen: boolean
  modelMenu: boolean
  repoMenu: boolean
  mobileNav: boolean
  composer: string
  sendMode: SendMode
  queued: string[]
  homeFilter: string
  vw: number
  composeText: string
  composeRepo: string
  skills: Record<string, boolean>
  model: string
  genuiTheme: 'light' | 'dark'
}

const initialState: UIState = {
  route: 'home',
  activeId: 's1',
  step: 0,
  rightOpen: false,
  rightTab: 'files',
  diffIndex: 0,
  treeOpen: false,
  modelMenu: false,
  repoMenu: false,
  mobileNav: false,
  composer: '',
  sendMode: 'steer',
  queued: [],
  homeFilter: 'all',
  vw: typeof window !== 'undefined' ? window.innerWidth : 1280,
  composeText: '',
  composeRepo: 'acme/web-app',
  skills: { tests: true, lint: false, docs: false },
  model: 'sonnet',
  genuiTheme: 'light',
}

export function useAppStore(service: PiService) {
  const [state, setState] = useState<UIState>(initialState)
  // Bump to force a re-render when the service mutates its in-memory store.
  const [, setRev] = useState(0)
  const stateRef = useRef(state)
  stateRef.current = state

  const patch = useCallback((p: Partial<UIState> | ((s: UIState) => Partial<UIState>)) => {
    setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }))
  }, [])

  // Re-render on service store changes.
  useEffect(() => service.subscribe(() => setRev((r) => r + 1)), [service])

  // Responsive viewport tracking.
  useEffect(() => {
    const onResize = () => patch({ vw: window.innerWidth })
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [patch])

  // Streaming clock — advances the reveal of the live session's final message.
  useEffect(() => {
    const t = setInterval(() => {
      const s = stateRef.current
      if (s.route !== 'session') return
      const sess = service.getSession(s.activeId)
      if (!sess || !sess.live) return
      const max = streamMax(sess)
      if (s.step >= max) return
      setState((prev) => ({ ...prev, step: prev.step + 1 }))
    }, STREAM_TICK_MS)
    return () => clearInterval(t)
  }, [service])

  const sessions = service.listSessions()
  const activeSession = service.getSession(state.activeId)
  const mobile = state.vw < MOBILE_BREAKPOINT

  // ---- navigation / actions ----
  const openSession = useCallback(
    (id: string) => {
      patch({
        route: 'session',
        activeId: id,
        step: 0,
        treeOpen: false,
        modelMenu: false,
        mobileNav: false,
        diffIndex: 0,
        rightOpen: false,
        queued: [],
        composer: '',
      })
    },
    [patch],
  )

  const go = useCallback(
    (route: Route) => patch({ route, mobileNav: false, modelMenu: false, repoMenu: false }),
    [patch],
  )

  const doSend = useCallback(
    (mode: SendMode) => {
      const s = stateRef.current
      const text = s.composer.trim()
      if (!text) return
      const sess = service.getSession(s.activeId)
      if (!sess) return
      if (mode === 'follow') {
        patch((prev) => ({ queued: [...prev.queued, text], composer: '' }))
        return
      }
      const steering = !!sess.live && s.step < streamMax(sess)
      service.sendMessage(sess.id, text, { steer: steering })
      patch({ composer: '' })
    },
    [patch, service],
  )

  const stopRun = useCallback(() => {
    const s = stateRef.current
    const sess = service.getSession(s.activeId)
    if (!sess) return
    service.stopRun(sess.id)
    patch({ step: streamMax(sess) })
  }, [patch, service])

  const startTask = useCallback(() => {
    const s = stateRef.current
    const sess = service.startSession({
      prompt: s.composeText,
      repo: s.composeRepo,
      model: s.model,
      skills: s.skills,
    })
    openSession(sess.id)
  }, [openSession, service])

  const pickOption = useCallback(
    (option: string) => {
      const sess = service.getSession(stateRef.current.activeId)
      if (sess) service.pickOption(sess.id, option)
    },
    [service],
  )

  const actions = useMemo(
    () => ({
      openSession,
      goHome: () => go('home'),
      goSettings: () => go('settings'),
      goCompose: () => go('compose'),
      goReview: () => go('review'),
      backToSession: () => go('session'),
      doSend,
      stopRun,
      startTask,
      pickOption,
      patch,
    }),
    [openSession, go, doSend, stopRun, startTask, pickOption, patch],
  )

  return { state, patch, mobile, sessions, activeSession: activeSession as Session | undefined, actions }
}

export type AppStore = ReturnType<typeof useAppStore>
