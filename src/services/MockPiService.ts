import type { Session } from '../lib/types'
import { SEED_SESSIONS } from '../data/seedSessions'
import type { PiService, SendMessageOptions, StartSessionParams } from './PiService'

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 24)
    .replace(/-$/, '')
}

/**
 * In-memory PiService used by the prototype/front-end. Newly created sessions are
 * prepended to the list (matching the prototype's `created.unshift`).
 *
 * Replace this with a real implementation that calls the Pi RPC/SDK; the rest of
 * the app is unaffected.
 */
export class MockPiService implements PiService {
  private created: Session[] = []
  private listeners = new Set<() => void>()

  private emit() {
    this.listeners.forEach((l) => l())
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  listSessions(): Session[] {
    return [...this.created, ...SEED_SESSIONS]
  }

  getSession(id: string): Session | undefined {
    return this.listSessions().find((s) => s.id === id)
  }

  startSession(params: StartSessionParams): Session {
    const text = params.prompt.trim() || 'Implement the requested change'
    const id = 'c' + (this.created.length + 1)
    const title = text.length > 52 ? text.slice(0, 52).trim() + '…' : text
    const sess: Session = {
      id,
      title,
      repo: params.repo,
      branch: 'pi/' + slugify(title),
      status: 'working',
      model: params.model,
      latest: 'Starting…',
      time: 'now',
      add: 55,
      del: 6,
      live: true,
      thread: [
        { role: 'user', text },
        {
          role: 'agent',
          streaming: true,
          intro: "I'll scope this out, make the change, and run the tests before reporting back.",
          tools: [
            { kind: 'read', path: 'src/index.ts', meta: '120 lines' },
            { kind: 'search', path: 'related call sites', meta: '6 matches' },
            { kind: 'edit', path: 'src/feature.ts', meta: '+34 −6' },
            { kind: 'create', path: 'src/feature.test.ts', meta: '+27' },
            { kind: 'test', path: 'npm test', meta: '9 passed' },
          ],
          text: 'Done — implemented the change across 3 files and added a test. All 9 tests pass. Ready for your review.',
        },
      ],
      changes: [
        {
          path: 'src/feature.ts',
          status: 'M',
          add: 34,
          del: 6,
          diff: [
            { t: '@', c: '@@ feature @@' },
            { t: '+', c: '// implementation' },
          ],
        },
        {
          path: 'src/feature.test.ts',
          status: 'A',
          add: 27,
          del: 0,
          diff: [{ t: '+', c: "describe('feature', () => { /* … */ })" }],
        },
      ],
      terminal: ['$ npm test', '', 'Tests: 9 passed', 'Time: 1.1 s'],
      tree: [
        { label: title, meta: 'initial request', node: 'root' },
        { label: 'Implement', meta: 'edit · create', bookmark: true },
        { label: 'Run tests', meta: 'current', current: true },
      ],
    }
    this.created.unshift(sess)
    this.emit()
    return sess
  }

  sendMessage(sessionId: string, text: string, opts: SendMessageOptions): void {
    const sess = this.getSession(sessionId)
    if (!sess) return
    sess.thread.push({ role: 'user', text, steer: opts.steer })
    this.emit()
    // Simulated agent acknowledgement. A real transport would stream tokens back.
    setTimeout(() => {
      sess.thread.push({
        role: 'agent',
        intro: opts.steer ? 'Got it — folding that into the current run.' : 'On it.',
        tools: [],
        text: '',
      })
      this.emit()
    }, 850)
  }

  pickOption(sessionId: string, option: string): void {
    const sess = this.getSession(sessionId)
    if (!sess) return
    sess.thread.push({ role: 'user', text: option })
    this.emit()
  }

  stopRun(sessionId: string): void {
    const sess = this.getSession(sessionId)
    if (!sess) return
    sess.live = false
    this.emit()
  }
}
