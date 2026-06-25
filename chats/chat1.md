# Pi remote interface design

_Started 2026-06-23 10:02 UTC_

---

## User

pi remote, a remote interface like claude web interface for pi coding agent

## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: list_files]_

The design system project is empty, so I have no visual context to work from yet. Let me ask a few questions before building.

_[tool: questions_v2]_

## User

Questions answered:
- context: https://pi.dev
- purpose: Start coding tasks & watch the agent work in real time, Review/approve agent changes (diffs, PRs) from phone or desktop, Manage many concurrent agent sessions across repos, Full chat + code workspace (chat, file tree, diffs, terminal), Explore a few options
- platform: Both, responsive
- screens: Live agent session (chat + streaming work), Session list / home (all active tasks), Diff / code review view, Explore a few options, New task composer, Settings / repo connections
- variations: Just one solid direction
- explore_dim: Layout / information architecture, Novel interactions & metaphors for agent work
- vibe: Clean & minimal like Claude.ai
- fidelity: Clickable interactive prototype

## Assistant

Let me look at pi.dev for brand context.Let me grab the logo SVG.Pi is a minimal, terminal-based coding agent (Earendil Inc.) — signature features are tree-structured sessions, steer-vs-follow-up messaging, mid-session model switching, and "make it yours" extensibility. I'll build a clean, Claude.ai-minimal remote interface that brings those metaphors to the web, as one interactive Design Component.

_[tool: update_todos]_

_[tool: web_fetch]_

_[tool: web_fetch]_

_[tool: web_fetch]_

_[tool: dc_write]_

Let me check it renders.

_[tool: show_html]_

_[tool: show_html]_

Home looks clean. Let me check the live session (the hero) and confirm streaming + tools render.

_[tool: eval_js]_

_[tool: sleep]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

Streaming and tool cards render well. Let me verify the working-bar/steer state and the diff/tree panels via a quick probe.

_[tool: eval_js]_

Streaming completed (working bar shows only during stream). Let me confirm the working bar appears mid-stream and check the review screen, work panel, and tree in one pass.

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: save_screenshot]_

_[tool: eval_js]_

State batching in my test — the component is fine. Now on home; clicking the card now:

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: save_screenshot]_

_[tool: eval_js]_

_[tool: eval_js]_

Panel is correctly positioned (screenshot tool just mis-renders fixed overlays). Let me confirm the working bar renders during an active stream:

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

Everything works — streaming tool cards, working bar, model switcher, work panel (files/diff/terminal), session tree, review CTA, steer/follow-up composer, and the waiting-on-input session with reply chips. Responsive shell switches to mobile drawer under 860px.

_[tool: update_todos]_

_[tool: ready_for_verification]_

Built **Pi Remote** — a clean, Claude.ai-minimal web interface for the Pi terminal coding agent, as one interactive Design Component.

**Direction:** warm paper/ink palette with one signal-green accent, Hanken Grotesk UI + JetBrains Mono for code/agent tokens, and a status language (working/needs-review/waiting/done/failed) used consistently across cards, pills, and dots.

**Five connected screens:**
- **Sessions home** — control-room of all live tasks across repos, filterable by status, each card showing the agent's latest action + diff stats.
- **Live session** — streaming chat with tool-call cards (read/search/edit/create/run) that appear and resolve in real time, a working bar you can steer or stop, and a review CTA on completion.
- **Composer** — pi's signature steer (↵) vs follow-up (⌥↵) modes, plus a model switcher (⌃L) across 15+ providers.
- **Session tree** — pi's tree-structured history as a slide-over with branch/bookmark/rewind and `/share`.
- **Work panel** (files/diff/terminal), **code review**, **new task**, and **settings** (repos/providers/defaults).

Responsive: collapses to a mobile top bar + drawer below 860px.

Notes: it's a self-contained prototype with simulated streaming and seeded data. Easy next steps if useful — wire it to the real Pi RPC/SDK, add per-hunk diff approval, or live-stream multiple concurrent sessions.

