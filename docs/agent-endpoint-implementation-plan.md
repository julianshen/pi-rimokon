# Implementation plan — `/agent` endpoint (v1)

Turns [`agent-endpoint-spec.md`](./agent-endpoint-spec.md) into sequenced, shippable work. Scope is
**v1** from spec §9: standalone Node WS server, RFC 8628 device flow, `/agent` + `/client` sockets,
single-instance in-memory broker, frontend integration, and self-hosted deployment behind the
`agents.jlnshen.com` Cloudflare Tunnel. Horizontal scale / event replay (spec §9 v2) is **out of
scope** here.

## Stack & layout

- **Server:** Node 20+ / TypeScript. HTTP via **Express**, WebSockets via **`ws`** (raw — keeps the
  wire exactly as specced; no Socket.IO framing). One `http.Server` handles both: Express for
  routes, a `WebSocketServer({ noServer:true })` that dispatches the `upgrade` event by path
  (`/agent`, `/client`).
- **Crypto/JWT:** [`jose`](https://github.com/panva/jose) for RS256 sign/verify, our JWKS, and
  Supabase-JWT verification against the project JWKS.
- **Data:** Supabase Postgres via `@supabase/supabase-js` with the **service-role** key (bypasses
  RLS; ownership enforced in code per spec §5.3/§6).
- **Tests:** Vitest (matches the SPA). The existing app keeps its **≥90%** gate; the server targets
  **≥85%** on core logic (tokens, device flow, broker routing) with integration tests driving a
  real `ws` client.
- **Repo layout (recommended, adjustable):** add a self-contained **`server/`** project (own
  `package.json`) and a **`shared/protocol.ts`** (message kinds, close codes, envelope types)
  imported by both server and SPA via a TS path alias — so the wire contract has one source of
  truth. *This is the one open layout decision; see "Decisions" below.*

```
server/
  src/
    index.ts            # http + ws bootstrap, upgrade routing by path
    config.ts           # env schema (fail-fast)
    db/{client.ts,migrations/*.sql}
    auth/{deviceFlow.ts,tokens.ts,supabaseJwt.ts,jwks.ts,revocation.ts}
    ws/{agent.ts,client.ts,framing.ts,heartbeat.ts}
    broker/{registry.ts,router.ts}
    http/{ticket.ts,cors.ts,health.ts}
  test/...
shared/protocol.ts      # envelope, message kinds, close codes (imported by SPA + server)
```

## Milestones

| # | Milestone | Depends on | Outcome | PR |
|---|---|---|---|---|
| M0 | Scaffold + DB schema + shared contract | — | Server boots, `/healthz` 200, migrations apply | 1 |
| M1 | Device flow (RFC 8628) + token model | M0 | `pi login` over curl yields an agent JWT | 1–2 |
| M2 | Agent socket `/agent` | M1 | Agent connects, authenticates, session row created | 2 |
| M3 | Web-client socket `/client` + broker | M2 | Browser sees its agent's events end-to-end | 3 |
| M4 | Frontend integration (SPA) | M1, M3 | Real Pi Remote drives a live agent | 4 |
| M5 | Deployment + hardening | M2–M4 | Live at `wss://agents.jlnshen.com` | 5 |

Sequence is M0→M1→M2→M3→M4→M5. After M3 freezes the wire contract, **M4 (frontend) and M5
(deploy/hardening) can proceed in parallel.** A tiny **fake-agent harness** (a ~100-line `ws`
client emitting `hello`/events) lands in M2 and drives M2–M5 without the real Pi binary.

---

### M0 — Scaffold, schema, shared contract
**Build:** `server/` project (TS, ESLint, Vitest, dotenv config with fail-fast env schema);
`http.Server`+Express skeleton with `GET /healthz`; `shared/protocol.ts` (message-kind unions,
close-code enum 4400/4401/4403/4408/4409/4413, framing limits); Postgres migrations for
`device_codes`, `agent_tokens`, `refresh_tokens`, `agent_sessions` (spec §6) as SQL applied via a
`migrate` script.
**Acceptance:** server starts; `/healthz` 200; migrations create the four tables; `shared/protocol`
imports cleanly from both server and SPA; CI runs server tests.

### M1 — Device authorization + tokens (spec §3)
**Build:** `POST /oauth/device/code` (form-encoded, issues `device_code`/`user_code`);
`POST /oauth/device/approve` (verifies **Supabase JWT** via project JWKS, binds `user_id` or denies);
`POST /oauth/device/token` (poll loop with all RFC states: `authorization_pending` / `slow_down` /
`access_denied` / `expired_token` → approved); `POST /oauth/revoke`; `GET /.well-known/jwks.json`.
RS256 keypair from env; agent JWT (`aud:"pi-agent"`, `jti`, `exp≈1h`); **rotating** refresh tokens
(hashed, `family_id`, reuse → revoke family); revocation lookups.
**Acceptance (tests):** full happy path; each error state; `slow_down` on fast polling; expiry;
agent-JWT verify (good/tampered/expired/wrong-aud); refresh rotation + reuse-detection revokes the
family; revoked token rejected. A curl walkthrough yields a usable JWT.

### M2 — Agent WebSocket `/agent` (spec §4)
**Build:** upgrade auth (`Authorization: Bearer`, fallback `hello.token`); `hello`/`response`/`ready`
handshake with capability + `protocol:"pi.rpc/1"` negotiation; **handshake timeout ~5s → 4408**;
framing guard (1 JSON object/frame, **1 MiB → 4413**, binary → 4400); ping/pong **heartbeat**
(miss → 4408); per-session monotonic `seq`; `agent_sessions` lifecycle (status `started`→`ended`);
**revocation tear-down → 4403** (control hook from M1); **availability advertisement** in `hello`
(`mode`/`state`/`cwd` + `accept_task`, spec §4.1/§5.4); resume = rebind only (no replay, per §9).
Ships the **fake-agent harness** (incl. an idle `accept_task` agent for §5.4 testing).
**Acceptance (tests):** reject bad/expired token (401/4401); handshake success path; handshake
timeout; oversized frame 4413; heartbeat-miss 4408; protocol-major mismatch 4400; mid-session
revoke closes 4403; session row created/closed.

### M3 — Web client `/client` + broker (spec §5)
**Build:** `POST /client/ticket` (Supabase JWT → single-use, ~30s ticket); `/client` upgrade via
ticket (validate+burn), `Origin` allow-list, **CORS** on ticket + device endpoints for the Vercel
origin; in-memory **per-user registry** (agent sessions + web clients); **router** — web→agent
ownership-checked forward (drop+`error` on mismatch) **with broker-unique `id` rewrite + restore on
the response** (spec §5.3 — so two tabs reusing a client-local `id` can't collide), event **fan-out**
(`session_id`+`seq`) to the user's watching clients; broker events `sessions` snapshot (incl. each
agent's idle/busy `state`) / `session_online` / `session_offline` / `agent_state`; **`start_task`
routing to a chosen idle agent** (spec §5.4, incl. the `no_available_agent` reply); multiplexing
envelope (`session_id`).
**Acceptance (tests):** cross-user routing blocked; snapshot on connect (with `state`); presence
online/offline; fan-out to multiple clients; command forwarded to the right agent; **two tabs sending
the same client-local `id` don't collide** (broker-id rewrite); **`start_task` reaches a chosen idle
agent, `no_available_agent` when none**; ticket single-use + expiry.

### M4 — Frontend integration (existing SPA, spec §8)
**Build:** `WebSocketPiService implements PiService` gated on `VITE_PI_SERVER_URL` (else
`MockPiService`): fetch ticket with the Supabase session, connect `/client`, map
`sessions`/`session_online` → `listSessions()`, send commands by `session_id`, feed `event`s into the
existing `sessionView` view-model; map **`startSession(repo, prompt)` → pick an idle agent (§5.4) +
`start_task`**, surfacing "no available agent" when none match. Observe/steer needs no shell changes;
the new-task flow adds a small **idle-agent picker** (when >1 matches). New **`/device`** route
(approval UI; authed Supabase → `device/approve`; **preserves `user_code` across sign-in** since
OAuth returns to origin). **Settings → Agents** view (list/revoke `agent_tokens`).
Auto-reconnect/backoff on the client.
**Acceptance (tests, keep ≥90% gate):** service unit tests against a mock `ws` (snapshot mapping incl.
`state`, command send, reconnect, **`startSession`→`start_task` + no-available-agent**); idle-agent
picker; `/device` approve/deny; Agents list/revoke; `VITE_PI_SERVER_URL` unset → MockPiService
unchanged. Manual end-to-end against a locally-run server + fake agent.

### M5 — Deployment & hardening (spec §8.1)
**Build:** `cloudflared` named tunnel for `agents.jlnshen.com` (config.yml ingress → `localhost:PORT`)
+ systemd unit; env/secrets (RS256 keys, Supabase service-role + JWKS URL, allowed Origin);
per-connection **rate limits**, max frame, **max sessions/clients per user**; structured logging +
basic metrics (connections, sessions, routing errors); **graceful shutdown** (drain sockets, advise
reconnect); agent-side reconnect/backoff. Deployment **runbook** in `docs/`.
**Acceptance:** from a clean host, `pi login` → approve in Pi Remote → idle agent online → browser
**starts a task on it** and observes/steers live over `wss://agents.jlnshen.com`; restart drains
cleanly and both sides reconnect.

---

## Cross-cutting

- **Security (spec §7):** TLS only (Cloudflare edge); hash `device_code`/`refresh_token`/`ticket`;
  rate-limit device polling + ticket issuance; `aud`-scoped revocable short JWTs; Origin allow-list
  + CORS; verify Supabase JWT (`iss`/`aud`/`exp`).
- **Observability:** structured logs keyed by `session_id`/`user_id`; counters for connects, auth
  failures, routing drops, close codes.
- **Config:** one env schema, fail-fast (mirrors the SPA's `ConfigNotice` pattern). `.env.example`
  for the server.
- **CI:** add a `server/` test job; keep the SPA's existing job + ≥90% gate untouched.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Real Pi RPC vocabulary differs from assumptions | Wire is transport-only; the fake-agent harness + thin envelope isolate us from command/event specifics (spec §1) |
| Cloudflare idle timeouts drop sockets | §4.3 heartbeat keeps them warm; client auto-reconnect |
| Coverage gate friction on network glue | Unit-test pure logic (tokens, router, framing); integration-test sockets; 85% server target |
| Secret sprawl (RS256 keys, service-role) | Env-only, documented in the runbook; never in the repo |

## Decisions to confirm (defaults chosen so work isn't blocked)

1. **Repo layout** — default: `server/` project + `shared/protocol.ts` in this repo. Alt: separate
   repo. *(Recommend in-repo for a solo self-host.)*
2. **Sessions per token** — default **multiple concurrent sessions allowed** (broker keys by
   `session_id`); the single-session `4409` path stays off in v1.
3. **Server coverage target** — default **85%** on core logic. Raise to match the SPA's 90% if you
   prefer one bar.

None of these block M0–M1; flag changes and I'll fold them in.
