# Pi Remote — implementation

A React + Vite + TypeScript implementation of the **Pi Remote** design — a
Claude.ai-minimal web interface for the Pi terminal coding agent. Built from the
Claude Design handoff bundle in `project/Pi Remote.dc.html` (see `chats/` for the
design intent).

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values (see Authentication)
npm run dev        # http://localhost:5173
npm run build      # typecheck (tsc -b) + production build to dist/
npm run preview    # serve the production build
```

> Fonts (Hanken Grotesk + JetBrains Mono) load from Google Fonts at runtime.

> Without Supabase env vars the app boots to a "Sign-in isn't configured yet"
> notice instead of crashing — fill them in to enable sign-in.

## Authentication (Google + GitHub sign-in)

The whole app is gated behind **Sign in with Google or GitHub**, implemented with
[Supabase Auth](https://supabase.com/auth). Supabase brokers both OAuth flows, so
the client only needs two public values, supplied via Vite env vars:

| Variable                 | Where to find it                                    |
| ------------------------ | --------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL     |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon/public key |

Both are publishable (the anon key is RLS-gated and meant to ship in the
browser), so they're safe to expose client-side.

### One-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com). Its
   OAuth callback is `https://<your-project-ref>.supabase.co/auth/v1/callback` —
   both providers below point at it.
2. **Google** — in the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   *Create Credentials → OAuth client ID → Web application*; add the Supabase
   callback under **Authorized redirect URIs**. Then in Supabase →
   *Authentication → Providers → Google*, paste the **Client ID** + **Client
   secret** and enable it.
3. **GitHub** — in GitHub → *Settings → Developer settings → OAuth Apps → New
   OAuth App*; set **Authorization callback URL** to the same Supabase callback.
   Then in Supabase → *Authentication → Providers → GitHub*, paste the **Client
   ID** + **Client secret** and enable it.
4. **Set the allowed app URLs** in Supabase → *Authentication → URL
   Configuration*:
   - **Site URL**: `https://pi-rimokon.vercel.app`
   - **Redirect URLs**: add `http://localhost:5173` (dev),
     `https://pi-rimokon.vercel.app` (prod), and — for Vercel preview deploys —
     `https://*.vercel.app`.
5. **Local dev**: `cp .env.example .env.local` and fill in the two values.
6. **Vercel**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under
   *Project → Settings → Environment Variables*, then redeploy (Vite inlines env
   vars at build time, so a rebuild is required after changing them).

> Enable only the providers you've configured — a button for an unconfigured
> provider will error on click. Both are independent, so Google-only or
> GitHub-only setups work too.

Sign-in redirects back to `window.location.origin`, so the same setup works in
dev and on every deployment with no per-environment code. Sessions persist
across reloads; sign-out lives in the sidebar footer, the mobile nav drawer, and
**Settings → Account**.

### How it's wired

```
src/
  lib/supabase.ts          the Supabase client (null + a notice if env is unset)
  hooks/useAuth.tsx        AuthProvider + useAuth() — session, profile,
                           signInWith(provider), signOut
  components/
    AuthGate.tsx           splash while loading → LoginScreen when out → app when in
    LoginScreen.tsx        the gate: a button per provider + unconfigured notice
    Avatar.tsx             provider picture with an initials fallback
```

Adding another Supabase-supported provider is two lines: a new entry in the
`OAuthProvider` union (`useAuth.tsx`) and one in the `PROVIDERS` list
(`LoginScreen.tsx`). `main.tsx` wraps `<App/>` in `<AuthProvider><AuthGate>…`.
Auth is independent of the `PiService` seam, so swapping the mock transport for a
real Pi backend doesn't touch sign-in.

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
