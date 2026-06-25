# Pi Remote — implementation

A React + Vite + TypeScript implementation of the **Pi Remote** design — a
Claude.ai-minimal web interface for the Pi terminal coding agent. Built from the
Claude Design handoff bundle in `project/Pi Remote.dc.html` (see `chats/` for the
design intent).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck (tsc -b) + production build to dist/
npm run preview    # serve the production build
```

> Fonts (Hanken Grotesk + JetBrains Mono) load from Google Fonts at runtime.

## What's here

Five connected screens plus three slide-overs, ported pixel-for-pixel from the
prototype:

- **Sessions home** — control-room of all live tasks across repos, filterable by
  status, each card showing the agent's latest action + diff stats.
- **Live session** — streaming chat with tool-call cards (read / search / edit /
  create / run / test) that reveal and resolve in real time, a working bar you can
  steer or stop, a model switcher (⌃L), and a review CTA on completion.
- **Code review** — changed-files list + line-numbered diff, approve/request.
- **New session composer** — repo picker, skills, examples, `Start session`.
  (Present in the design; its nav entry points were removed in the second design
  chat because every session is a live Pi instance, so it isn't linked from the
  chrome — the `compose` route still renders it if navigated to.)
- **Settings** — connected agents/repos.
- **Slide-overs** — work panel (Files / Diff / Terminal), session tree
  (branch / bookmark / rewind / `/share`), and the mobile nav drawer.

Generative-UI is supported on agent messages: an interactive live **preview**
(working dark-mode toggle) and an inline **chart** (p95 latency with the
post-deploy spike highlighted).

Responsive: the desktop sidebar collapses to a mobile top bar + drawer below
860px.

## Architecture

```
src/
  lib/
    theme.ts          design tokens — palette, status language, tool styling, diff/badge colors
    types.ts          domain model (Session, ThreadMessage, ToolCall, FileChange, …)
    sessionView.ts    pure view-model logic: streaming reveal + generative-UI builders
  data/
    models.ts         model list for the switcher
    seedSessions.ts   seeded sessions (replace with real data when wiring a backend)
  services/
    PiService.ts      transport-agnostic interface (the backend seam)
    MockPiService.ts  in-memory implementation with simulated agent replies
  hooks/
    useAppStore.ts    UI state + service wiring + the streaming clock
  components/         one file per screen / slide-over + shared icons + thread renderers
  App.tsx             shell: routing between screens, mounts slide-overs
```

### The backend seam

Per the brief, the UI is structured so it can be wired to a real Pi RPC/SDK
without touching components. Everything flows through the `PiService` interface
(`src/services/PiService.ts`):

```ts
interface PiService {
  listSessions(): Session[]
  getSession(id: string): Session | undefined
  startSession(params): Session
  sendMessage(sessionId, text, { steer }): void
  pickOption(sessionId, option): void
  stopRun(sessionId): void
  subscribe(listener): () => void
}
```

`MockPiService` fulfils it with the seeded data and `setTimeout`-based agent
acknowledgements. To go live, implement `PiService` against the real transport
(e.g. websocket subscriptions for streaming + RPC for mutations) and swap the
single `new MockPiService()` in `App.tsx`. Streaming presentation (the token/tool
reveal) is isolated in `sessionView.ts` + the clock in `useAppStore.ts`, so a real
event stream can drive the same view model.

## Fidelity notes

- Styling matches the prototype's exact inline values (spacing, radii, colors,
  fonts); the base styles, scrollbars and keyframes are ported verbatim into
  `src/styles/global.css`. Hover states the prototype expressed via `style-hover`
  attributes are reproduced with small utility classes in that file.
- The session header shows the globally-selected model (a prototype behavior),
  while session cards show each session's own model.
- The Settings screen renders the single populated "Connected agents" card; the
  prototype's trailing provider card was emptied out across the design edits and
  renders nothing, so it is omitted.
