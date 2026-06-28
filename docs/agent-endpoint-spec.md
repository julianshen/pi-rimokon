# Spec: `/agent` WebSocket endpoint + device-flow auth

**Status:** Draft for review · **Owner:** Pi Remote · **Protocol version:** `pi.rpc/1`

This spec defines how a **Pi coding agent** (a CLI/headless process on a developer's
machine) connects to the Pi Remote backend over WebSocket, authenticates with the
**OAuth 2.0 Device Authorization Grant (RFC 8628)** so the server knows **which user
the session belongs to**, and exchanges messages using **Pi's RPC envelope**
(`command` / `response` / `event`, see <https://pi.dev/docs/latest/rpc>) carried over
the socket. It also covers the **broker** that lets a user's Pi Remote browser session
observe and drive its own agents.

Decisions locked for this spec: standalone **Node WebSocket server** (the chosen transport —
typically **self-hosted behind a Cloudflare Tunnel**, see §8.1); **custom RFC 8628** device flow
issuing **app-scoped, revocable agent tokens** bound to the Supabase user; scope =
**agent endpoint + broker + web client**.

> **Decision:** this standalone design is the chosen transport. A sibling design that hosts
> `/agent` on Vercel's Fluid-compute WebSockets ([`agent-endpoint-spec-vercel.md`](./agent-endpoint-spec-vercel.md))
> is **retained as an escape hatch** — auth, the Pi RPC envelope, framing, and broker ownership
> are shared, so only the transport host would change. See the
> [side-by-side comparison](./agent-endpoint-comparison.md) for the trade-offs.

---

## 1. Background & constraints

- The Pi Remote frontend is a static Vite SPA on **Vercel** and uses **Supabase Auth**
  (GitHub login) for the browser user identity. Vercel cannot host long-lived
  WebSockets, so `/agent` lives in a **new standalone service** (the *Pi Remote Server*).
- Pi's RPC protocol (the doc) is a **JSONL, stdin/stdout** protocol — **not** JSON-RPC 2.0.
  Three message kinds:
  - **Command** (into the agent): `{"type":"<cmd>","id":"<opt>", …fields}`
  - **Response** (out of the agent): `{"type":"response","command":"<cmd>","id":"<matched>","success":true|false,"data":{…}?,"error":"<str>"?}`
  - **Event** (out of the agent, unsolicited): `{"type":"<event>", …fields}` (no `id`)
  - It has **no auth, versioning, or subscription** layer — we add those around it.
- Natural mapping: the agent's **stdin → frames the server sends** (commands); the agent's
  **stdout → frames the agent sends** (responses + events). Our server plays the role the
  parent process used to play, but over a socket.

## 2. Components & terminology

| Term | Meaning |
|---|---|
| **Agent** | Pi coding agent process; connects to `wss://<host>/agent`. One connection = one **session**. |
| **Web client** | Pi Remote browser app; connects to `wss://<host>/client`; observes/controls the user's agents. |
| **Server / Broker** | New Node service. Terminates both sockets, authenticates them, and routes messages per user. |
| **User** | Identified by the Supabase user id (`sub`) from GitHub login. |
| **Agent token** | App-issued, scoped, revocable credential the agent uses to authenticate its socket. |
| **Session** | A live agent connection owned by a user; `session_id` (server-assigned, e.g. `ses_<ulid>`). |

```
 Pi agent (CLI) ──wss /agent (agent token)──┐
                                            ▼
                                     Pi Remote Server ──► Supabase (identity + Postgres)
                                            ▲
 Browser (Pi Remote) ─wss /client (ticket)──┘
```

## 3. Device authorization (RFC 8628)

The agent has no browser. It uses the device grant: the **agent** gets a code, the **user**
approves it inside Pi Remote (already signed in via Supabase), the **agent** polls for a token.

### 3.1 Endpoints (HTTPS on the server)

**`POST /oauth/device/code`** — agent starts authorization. Per RFC 8628 / OAuth 2.0, requests
to the device-authorization and token endpoints are **`application/x-www-form-urlencoded`** (so
standard OAuth client libraries work); responses are JSON.
```http
POST /oauth/device/code HTTP/1.1
Content-Type: application/x-www-form-urlencoded

client_id=pi-agent-cli&scope=agent
```
```jsonc
// 200 response (RFC 8628 §3.2)
{
  "device_code": "<opaque, high-entropy>",
  "user_code": "WDJB-MJHT",
  "verification_uri": "https://pi-rimokon.vercel.app/device",
  "verification_uri_complete": "https://pi-rimokon.vercel.app/device?code=WDJB-MJHT",
  "expires_in": 900,
  "interval": 5
}
```

**User approval (web):** the user opens `verification_uri[_complete]` in Pi Remote. A new
`/device` route shows the agent details + `user_code` and an **Authorize / Deny** choice. If the
user is **signed out**, `/device` must **preserve the `user_code` across sign-in** — today's
`signInWith` redirects OAuth to `window.location.origin` (`src/hooks/useAuth.tsx`), which would drop
`/device?code=…`; so the page stashes the code (e.g. `sessionStorage`) or sets `redirectTo` back to
the full `/device?code=…` URL, then resumes approval once the Supabase session exists.
On approve the SPA calls (with the Supabase session). This is **our own** endpoint — RFC 8628
leaves the verification interaction undefined — so it takes JSON rather than form encoding:
```jsonc
// POST /oauth/device/approve   Authorization: Bearer <supabase_jwt>
{ "user_code": "WDJB-MJHT", "decision": "approve" }   // or "deny"
```
The server verifies the Supabase JWT (issuer/audience/exp via the project JWKS), finds the
pending device code by `user_code`, and binds `user_id = jwt.sub` (or marks it denied).

**`POST /oauth/device/token`** — agent polls (RFC 8628 §3.4); form-encoded like `device/code`.
```http
POST /oauth/device/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=<…>&client_id=pi-agent-cli
```
Responses:
| State | HTTP | Body |
|---|---|---|
| Pending | 400 | `{"error":"authorization_pending"}` |
| Polling too fast | 400 | `{"error":"slow_down"}` (server bumps `interval`) |
| Denied | 400 | `{"error":"access_denied"}` |
| Code expired | 400 | `{"error":"expired_token"}` |
| Approved | 200 | `{"access_token":"<agent JWT>","token_type":"Bearer","expires_in":3600,"refresh_token":"<…>","scope":"agent"}` |

### 3.2 Token model

- **Access token** = app-issued JWT, signed by the server (RS256; JWKS published at
  `/.well-known/jwks.json`). Claims: `iss` (server), `sub` (Supabase user id),
  `aud: "pi-agent"`, `jti`, `iat`, `exp` (~1h), `scope`. Short-lived.
- **Refresh token** = opaque, rotating, stored hashed; long-lived agents exchange it via
  `grant_type=refresh_token`. Rotation detects reuse (revoke the family on replay).
- **Revocation:** every token maps to an `agent_tokens` row (`jti`/family). A user can
  revoke an agent from Pi Remote (Settings → Agents); the server checks revocation on every
  connect and refresh **and tears down live sessions immediately** — on revoke it looks up the
  matching `agent_sessions` (by `jti`/`family_id`) and closes those sockets with **4403** rather
  than waiting for the next reconnect. `POST /oauth/revoke` supported.

## 4. Agent WebSocket — `wss://<host>/agent`

### 4.1 Connect & authenticate

The agent is a non-browser client, so it sends the token on the **upgrade request**:
```
GET /agent HTTP/1.1
Upgrade: websocket
Authorization: Bearer <agent access token>
Sec-WebSocket-Protocol: pi.rpc.v1
```
The server validates the JWT (signature, `aud:"pi-agent"`, `exp`, revocation). On failure it
rejects the upgrade `401`, or if already open, closes with **4401**. On success it assigns a
`session_id`, binds the connection to `user_id = token.sub`, and the **handshake** runs as a
normal Pi command/response so version + capabilities are negotiated (the base protocol has no
handshake of its own):

```jsonc
// agent → server (first frame)
{ "type":"hello", "id":"h1", "protocol":"pi.rpc/1",
  "agent": { "name":"pi", "version":"0.9.3", "repo":"acme/web-app", "cwd":"/home/dev/web-app",
             "mode":"interactive", "state":"idle",
             "capabilities":["tools","diff","genui","accept_task"] } }
// server → agent
{ "type":"response","command":"hello","id":"h1","success":true,
  "data": { "session_id":"ses_01J…", "user_id":"<supabase sub>", "server":"pi-remote/1.0.0", "heartbeat_sec":30 } }
// then, unsolicited:
{ "type":"ready", "session_id":"ses_01J…" }
```
A token may also be supplied in `hello.token` as a fallback for clients that cannot set the
upgrade header. Because that lets a socket open *before* it has authenticated, the server
enforces a **handshake timeout** (~5 s): a connection that hasn't completed a valid `hello`
within the window is closed (**4408**), bounding idle/unauthenticated-socket DoS. Unknown
`protocol` major → `success:false`, then close **4400**.

> **Identifier formats (intentionally different).** The WebSocket **subprotocol token** is
> `pi.rpc.v1` (dot-separated — `Sec-WebSocket-Protocol` must be a valid token), while
> `hello.protocol` is the **version string** `pi.rpc/1` in `<name>/<major>` form. The major must
> match in both; only the surface syntax differs.

> **Direction note.** `hello` (and `resume`, §4.3) invert §4.2's normal flow — here the *agent*
> sends a command-shaped frame and the *server* replies. Treat these as a **pre-routing
> exception** handled by the connection manager *before* the session is registered with the
> broker, so the §5.3 routing rules never see them and cannot block or misroute them.

### 4.2 Framing

- **One JSON object per WebSocket text frame** = one Pi JSONL record. No batching, no
  partial records. Binary frames are reserved (closed with **4400** in v1).
- UTF-8. Max frame size **1 MiB** (configurable). Oversized → close **4413**; large payloads
  (file contents, big diffs) should stream as multiple `event`s.
- Direction: **server→agent = `command`s**; **agent→server = `response`s + `event`s**
  (the stdin/stdout mapping from §1).

### 4.3 Ordering, heartbeats, resumption

- A stock Pi process does **not** emit a sequence field, so the **server stamps a monotonic
  `seq`** (per session) onto each agent→server `event` as it arrives; that enriched record is what
  gets fanned out, persisted, and advances `agent_sessions.last_seq`. Responses are correlated by
  `id` (which the agent *does* echo).
- Keepalive: WebSocket **ping/pong** every `heartbeat_sec`; no pong within 2× → close **4408**.
- **Reconnect/resume:** on reconnect the agent re-auths and may send
  `{"type":"resume","id":"r1","session_id":"ses_…","last_seq":42}`. If the server still holds
  the session (bounded grace window + ring buffer of recent events), it replays events
  `> last_seq` and continues; otherwise it returns `success:false` and a fresh `session_id`
  is issued. (v1 may rebind without replay — see §9.)

### 4.4 Close codes

| Code | Meaning |
|---|---|
| 1000 | normal |
| 4400 | protocol error / bad frame / unsupported version |
| 4401 | unauthorized (missing/invalid/expired token) |
| 4403 | forbidden (token revoked, or session not owned by user) |
| 4408 | idle / heartbeat timeout / handshake not completed in time |
| 4409 | duplicate session (same agent token already connected, if single-session enforced) |
| 4413 | frame too large |
| 1011 | internal server error |

Non-correlated failures use an `event`: `{"type":"error","code":"<machine>","message":"<human>"}`.

## 5. Web client WebSocket — `wss://<host>/client`

### 5.1 Connect & authenticate (browser-safe)

Browsers can't set `Authorization` on a WebSocket upgrade, so we use a **short-lived,
single-use ticket** rather than putting the Supabase JWT in the URL:
1. SPA calls `POST /client/ticket` with `Authorization: Bearer <supabase_jwt>` → `{ "ticket":"<opaque>", "expires_in":30 }`.
2. SPA opens `wss://<host>/client?ticket=<opaque>`. Server validates+burns the ticket, binds
   `user_id`, and (as in §4.1) runs a `hello`/`response` handshake. `Origin` is checked.

### 5.2 Multiplexing envelope

A web client talks to **many** of its agents, so the `/client` channel adds a `session_id`
to address a target. The inner payload is a pure Pi record:
```jsonc
// web client → server  (forwarded to that agent's /agent socket as a command)
// NB: Pi's `steer` carries the user text in `message` (not `text`); the UI seam maps its own
// field onto `message` on the wire.
{ "type":"steer", "id":"c7", "session_id":"ses_01J…", "message":"focus on the failing test" }
// server → web client (response routed back to the originating client by id)
{ "type":"response","command":"steer","id":"c7","session_id":"ses_01J…","success":true }
// server → web client (event fanned out to the user's clients watching that session)
{ "type":"tool_execution_update","session_id":"ses_01J…","seq":43, …fields }
```
Plus broker-level events the agent never sees:
- `{"type":"sessions","sessions":[{ "session_id":"<id>","repo":"<name>","status":"<status>","state":"<idle|busy>","agent":{…},"last_seq":0 }]}` (snapshot on connect)
- `{"type":"session_online","session_id":"<id>",…}` / `{"type":"session_offline","session_id":"<id>","reason":"<str>"}`
- `{"type":"agent_state","session_id":"<id>","state":"<idle|busy>"}` (availability changed — drives which agents can accept a new task, §5.4)

### 5.3 Routing rules (broker)

- The server keeps, per `user_id`, a registry of connected **agent sessions** and **web
  clients**.
- **Web → agent:** verify the target `session_id` belongs to the **same `user_id`** (else
  drop + `error`), strip `session_id`, **rewrite the command `id` to a broker-unique value** and
  record `broker_id → (web client, original id)`, then forward the inner command to that agent.
  (A client-supplied `id` is only unique within one tab, so two `/client` sockets watching the
  same agent could otherwise reuse the same `id` and collide on correlation.)
- **Agent → web:** correlate the `response` by its broker-unique `id` back to the **exact** web
  client that issued it, **restore the original `id`**, and deliver; **fan out** `event`s (with
  `session_id` + `seq`) to all of the user's web clients watching the session.
- Cross-user routing is impossible by construction — that is exactly how "whose session"
  is enforced.

### 5.4 Starting a task on an idle agent (browser-initiated)

Agents connect **inbound** (device flow → `/agent`), so the browser never spawns a process — but it
can hand a new task to an agent already connected and **idle**. An agent that accepts browser-started
work connects with `mode:"interactive"`, an initial `state:"idle"`, its `cwd`/`repo`, and the
`accept_task` capability (§4.1); the broker surfaces availability via the `sessions` snapshot
(`state`) and `agent_state` events (§5.2).

This maps the existing `PiService.startSession(repo, prompt)` seam:
1. The web client picks a target **`idle`** agent session, optionally matched by `repo` (if more than
   one matches, the UI lets the user choose).
2. It sends a **`start_task`** command:
   `{ "type":"start_task", "id":"c9", "session_id":"ses_…", "prompt":"<initial instruction>", "options":{…}? }`.
3. The broker forwards it (ownership-checked, id-rewritten per §5.3) to the agent. The agent flips to
   `busy` (emitting `agent_state`), responds
   `{"type":"response","command":"start_task","id":"c9","success":true}`, and streams `event`s for
   the active task; on completion it returns to `idle`.
4. If **no** idle agent matches, the broker replies `success:false`, `error:"no_available_agent"`,
   and the SPA surfaces "run `pi` in <repo> to start an agent" — the browser cannot start one itself.

So `startSession` resolves to *selecting* an already-connected idle agent and starting its task,
never to provisioning compute; a single-session agent that is already `busy` simply isn't offered.

## 6. Data model (Supabase Postgres, service-role access; RLS for direct reads)

- `device_codes(device_code_hash PK, user_code, client_id, status, user_id?, created_at, expires_at, last_polled_at, interval)`
- `agent_tokens(jti PK, family_id, user_id, label, scopes, created_at, last_seen_at, revoked_at?)` (access-token / family record)
- `refresh_tokens(token_hash PK, family_id, jti, user_id, issued_at, expires_at, used_at?, replaced_by?, revoked_at?)` — one row per rotating refresh token; presenting a token whose row is already `used_at`/`replaced_by` is **reuse → revoke the whole `family_id`**
- `agent_sessions(session_id PK, user_id, jti, repo, status, started_at, ended_at?, last_seq)` (history/presence)
- RLS: a user may read only rows where `user_id = auth.uid()`. The server uses the service
  role and enforces ownership in code; RLS protects any direct client access.

## 7. Security

- TLS for `wss`/`https` only. `device_code`/`refresh_token`/`ticket` are high-entropy and
  stored **hashed**; `user_code` is short, rate-limited, single-attempt-bound, and expiring.
- Device flow hardening: poll-rate limiting + `slow_down`; approval requires an authenticated
  Supabase session; codes are one-time and short-lived.
- Agent tokens are `aud`-scoped, revocable, short-lived + rotating refresh; revocation checked
  on connect/refresh.
- Per-connection rate limits, max frame size, **max sessions per user**, and max clients per
  user. `Origin` allow-list on `/client` (browser); agents send no `Origin`.
- Supabase JWT verified against the project JWKS (`iss`/`aud`/`exp`).

## 8. Frontend integration (Vite SPA)

- New env: `VITE_PI_SERVER_URL` — the server origin as a `wss://` URL (e.g.
  `wss://agents.jlnshen.com`). REST calls (`POST /client/ticket`, `/oauth/device/*`) hit the
  **same host over `https://`**, derived by swapping the scheme (`wss`→`https`) since `fetch`
  can't target a `wss:` URL. Without the env, the app keeps using `MockPiService` (the existing
  seam in `src/services/PiService.ts`).
- New `WebSocketPiService implements PiService`: gets a ticket, connects `/client`, maps the
  `sessions`/`session_online`/`agent_state` events into `listSessions()` (carrying each agent's
  idle/busy `state`), sends commands addressed by `session_id`, feeds incoming `event`s into the
  existing `sessionView` view-model, and maps **`startSession(repo, prompt)` → pick an idle agent
  (§5.4) + `start_task`** (surfacing "no available agent" when none match). Observe/steer needs no
  UI change; the new-task flow adds a small **idle-agent picker** when more than one matches.
- New `/device` route (device approval) and a **Settings → Agents** view (list/revoke
  `agent_tokens`).

### 8.1 Deployment topology — Vercel SPA + self-hosted server behind a Cloudflare Tunnel

The intended deployment self-hosts the server (e.g. on the Pi itself) and exposes it through a
**Cloudflare Tunnel**. The key fact: **Vercel is not in the WebSocket path and does not route to
the server** — the browser and agents connect **directly** to the tunnel hostname. Vercel serves
only the static SPA (including the `/device` page).

```
                     ┌─ static SPA + /device page ─► Vercel (pi-rimokon.vercel.app)
 Browser ────────────┤
   │  wss /client  +  https /client/ticket ─┐
   │                                        ▼
   │                          Cloudflare edge (TLS, WS upgrade) ──┐
 Agent ─ wss /agent ─────────────────────────────────────────────┤  Cloudflare Tunnel
                                                                  ▼  (cloudflared, outbound)
                                                   self-hosted Node server  ─►  Supabase
                                                   http://localhost:<port>      (Auth + Postgres)
```

**How it works**

1. `cloudflared` runs next to the server and opens an **outbound** connection to Cloudflare's
   edge — **no inbound ports, no firewall holes, no public IP** needed on the host.
2. A **named tunnel** maps the stable hostname **`agents.jlnshen.com`** → `http://localhost:<port>`
   via a DNS `CNAME` to `<tunnel-id>.cfargotunnel.com` and an ingress rule in the tunnel config
   (concrete config below). (A throwaway `*.trycloudflare.com` quick tunnel works for local testing.)
3. Cloudflare terminates TLS at its edge and **proxies the WebSocket `Upgrade`** down the tunnel
   to the local server — Cloudflare supports `wss` through both its proxy and Tunnel. The §4.3
   ping/pong heartbeat keeps connections alive past any idle timeout.
4. Everything on the server is reached at that one hostname: `wss://agents.jlnshen.com/agent`,
   `wss://agents.jlnshen.com/client`, and the HTTPS `/client/ticket`, `/oauth/device/*`,
   `/.well-known/jwks.json` endpoints.

**Tunnel setup (`agents.jlnshen.com`)**

```bash
cloudflared tunnel login
cloudflared tunnel create pi-remote                        # creates <tunnel-id> + credentials json
cloudflared tunnel route dns pi-remote agents.jlnshen.com  # adds the CNAME in Cloudflare DNS
cloudflared tunnel run pi-remote                           # or install as a systemd service
```
```yaml
# ~/.cloudflared/config.yml
tunnel: pi-remote
credentials-file: /home/pi/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: agents.jlnshen.com
    service: http://localhost:8787   # Node WS server; cloudflared forwards the HTTP Upgrade, the server completes the handshake
  - service: http_status:404
```

**Wiring**

- Set `VITE_PI_SERVER_URL=wss://agents.jlnshen.com` in Vercel; the SPA opens its `/client`
  socket and fetches its ticket from that origin. The `verification_uri` stays the Vercel
  `/device` page (§3.1) — the human approves in the browser; only the *API* lives on the tunnel.
- **Cross-origin:** the SPA origin (`https://pi-rimokon.vercel.app`) ≠ the server origin, so the
  server must (a) **allow that `Origin`** on `/client` (§7) and (b) send **CORS** headers
  (`Access-Control-Allow-Origin` for the Vercel origin, `Authorization` allowed) on **every
  browser-called HTTPS API** — `/client/ticket`, `/oauth/device/*`, `/oauth/revoke`, and the
  Settings → Agents list/revoke endpoints. WS frames aren't CORS-gated, but those fetches are.

**Why not proxy through Vercel.** Vercel `rewrites` forward plain HTTP but do **not** carry the
WebSocket `Upgrade` to an external origin, and Vercel's native WS support terminates sockets on
its own Fluid compute rather than reverse-proxying to your backend. So there is no supported way
to make `wss://pi-rimokon.vercel.app/agent` reach the tunnel — a second origin (the tunnel
hostname) is expected and correct for this design.

## 9. Phasing & known limitations

> A sequenced, milestone-by-milestone build of v1 is in
> [`agent-endpoint-implementation-plan.md`](./agent-endpoint-implementation-plan.md).

- **v1 (MVP):** device flow + `/agent` auth handshake + `/client` ticket + in-memory broker
  on a **single instance**; rebind-on-reconnect (no event replay); access+refresh tokens.
- **v2:** horizontal scale — the in-memory registry doesn't span instances, so add a shared
  bus (Redis pub/sub, Postgres `LISTEN/NOTIFY`, or NATS) for routing + presence; add the
  bounded per-session event ring buffer for `resume`/replay; multi-session-per-agent if needed.
- **Out of scope here:** the agent-side command/event *vocabulary* (that's Pi's own RPC doc);
  this spec only defines transport, auth, identity, and routing around it.

## 10. Example end-to-end flow

1. `pi login` → agent `POST /oauth/device/code` → prints `user_code` + URL.
2. Dev opens the URL in Pi Remote (signed in), approves → `device/approve` binds `user_id`.
3. Agent's `device/token` poll returns the agent JWT (+ refresh).
4. `pi` opens `wss://…/agent` with `Authorization: Bearer …` → `hello`/`ready`; server creates
   `ses_…` bound to the user.
5. Dev's browser is already on `/client`; it receives `session_online` for `ses_…`.
6. Dev clicks **Steer** → `{type:"steer",id,session_id}` → server forwards to the agent →
   agent streams `tool_execution_update` events (with `seq`) → fanned back to the browser →
   rendered by the existing thread view.
