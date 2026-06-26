# Spec (alternative): `/agent` on Vercel WebSockets (Fluid compute)

**Status:** Draft for review · **Owner:** Pi Remote · **Protocol version:** `pi.rpc/1`
**Relationship:** Alternative to [`agent-endpoint-spec.md`](./agent-endpoint-spec.md) (the
"standalone Node server" design). Everything about **identity, the Pi RPC envelope, framing,
close codes, and broker ownership rules is unchanged** — this document only re-homes the
transport onto **Vercel's WebSocket support** ([public beta](https://vercel.com/changelog/websocket-support-is-now-in-public-beta))
and works through the two constraints that move introduces.

> Read the base spec first. Below, "the base spec" = `agent-endpoint-spec.md`; section refs
> like "§4.2" point into it. This doc is a **delta**, not a replacement.

---

## 1. Why an alternative

The base spec opens with: *"Vercel cannot host long-lived WebSockets, so `/agent` lives in a new
standalone service."* That premise no longer holds — Vercel now serves WebSockets on **Fluid
compute**. So we can collapse the standalone *Pi Remote Server* into the **same Vercel project**
that already hosts the SPA: the device-flow endpoints become ordinary serverless functions, and
`/agent` + `/client` become WebSocket-capable functions. No second service to deploy or operate.

That win comes with two Vercel-specific constraints that **drive the whole design** below:

| Constraint (from Vercel docs / changelog) | Consequence for this spec |
|---|---|
| A socket is **pinned to its Function instance** for the connection's life; two clients can land on **different instances** and never see each other. | In-process routing only reaches *co-located* sockets. We **must** put an **external relay (Redis Streams)** between agent and browser. There is **no single-instance in-memory phase** (the base spec's v1). |
| A connection lives at most as long as the Function's **max duration**: **800 s default, up to 1800 s (30 min)** for Pro/Enterprise, configured per-function during the beta. | Sockets are **ephemeral by design**. **Reconnect + resume + event replay is a v1 requirement**, not a v2 nicety (base spec §4.3 / §9). The durable event log lives in Redis. |
| Billing is **active-CPU only** — idle connection time is **not** billed. | Mostly-idle agent sessions are cheap; heartbeats should stay lightweight (each ping is billable processing). |

## 2. Architecture

```
 Pi agent (CLI) ─wss /agent (Bearer agent token)─►  Vercel Function instance A ┐
                                                                               │ XADD events / commands
 Browser (Pi Remote) ─wss /client (ticket)───────►  Vercel Function instance B │
        ▲                                                    │                 ▼
        └──────────── fan-out from local sockets ────────────┘        Redis Streams (Upstash)
                                                                       per-session relay + history
                                          HTTPS device/token/ticket  ─►  Vercel Functions
                                                                            │
                                                              Supabase (identity + Postgres)
```

- **`/agent` and `/client`** are WebSocket Functions (Express + [`ws`](https://github.com/websockets/ws),
  or Socket.IO — both are supported on Fluid compute). The repo is a **Vite SPA**, not Next, so we
  add a small backend entry (an Express app exported as a Vercel Function, or `api/` functions) and
  let Vercel route the upgrade to it. Each function sets `maxDuration` (e.g. `vercel.json` →
  `1800`) and runs on a supported Node runtime.
- **Redis Streams** (e.g. Upstash, reachable from Vercel) is the **cross-instance bus**: one stream
  per session carries every `event` (commands too, see §4), and doubles as the **durable history**
  a reconnecting client replays. Presence + routing tables also live in Redis.
- **Supabase Postgres** keeps the same tables as the base spec (`device_codes`, `agent_tokens`,
  `agent_sessions`); identity is still Supabase Auth (GitHub).

## 3. What is byte-for-byte identical to the base spec

To avoid drift, these are **unchanged** — do not re-define them here:

- **Device authorization (RFC 8628)** — §3, including the form-encoded request fix and the
  custom JSON `/oauth/device/approve` endpoint. On Vercel these are plain HTTPS Functions; the
  JWKS at `/.well-known/jwks.json` is a static/route response. The RS256 signing key is a Vercel
  env var (server-only).
- **Token model & revocation** — §3.2 (short-lived `aud:"pi-agent"` JWT, rotating refresh,
  revocation that tears down live sessions — see §5 here for *how* termination crosses instances).
- **Agent auth on upgrade** — §4.1: Vercel Functions receive the upgrade request headers, so the
  agent still sends `Authorization: Bearer <token>`; the `hello`/`response`/`ready` handshake, the
  handshake timeout, and the "direction note" all apply verbatim.
- **Framing** — §4.2 (one JSON object per text frame, 1 MiB cap, server→agent = commands,
  agent→server = responses + events).
- **Close codes** — §4.4 (4400/4401/4403/4408/4409/4413/1011).
- **Web-client ticket auth + multiplexing envelope** — §5.1 / §5.2 (`POST /client/ticket`,
  `session_id`-addressed records). Browsers still can't set WS headers; the ticket is unchanged.
- **Broker ownership rules** — §5.3 (per-user registry, same-`user_id` enforcement, no cross-user
  routing). The *enforcement* is identical; only the *transport between instances* changes (§5).

## 4. The relay: routing across instances (replaces base §5.3's in-memory registry)

Because the agent socket and the browser socket may be on different instances, the broker registry
cannot be a process-local map. We use **Redis Streams**, one stream per session
(`sess:{session_id}`), as both the relay and the replay log:

- **Agent → web (events/responses):** the agent's instance `XADD`s each frame (already carrying
  `seq`, base §4.3) to `sess:{id}`. Every instance holding a `/client` socket *watching* that
  session keeps a blocking reader (`XREAD BLOCK` on a duplicated Redis connection) and **fans the
  entry out to its local sockets**. This is exactly the "stream does double duty as relay +
  history" pattern Vercel/Rivet describe for Fluid WebSockets.
- **Web → agent (commands):** the `/client` instance validates ownership (same `user_id`), strips
  `session_id`, and `XADD`s the inner command to a per-session **command** stream
  (`sess:{id}:cmd`); the agent's instance reads it and writes it to the agent socket.
- **Presence:** `session_online`/`offline` derive from a Redis key with a **short heartbeat TTL**
  (e.g. `presence:{session_id}` refreshed every `heartbeat_sec`). A reconnect within the grace
  window doesn't flap presence. A snapshot (`type:"sessions"`) is built by scanning the user's
  presence keys on `/client` connect.
- **Routing table:** `user:{uid}:sessions` (a Redis set) maps a user to their live sessions so the
  `/client` snapshot and fan-out know which streams to read. Ownership is still enforced in code;
  Postgres RLS still guards any direct reads.

> `seq` is assigned by the agent's instance (monotonic per session) and persisted as the Redis
> stream ID ordering, so replay (§6) and ordering survive instance hops.

## 5. Revocation across instances

Base §3.2 says revocation must close live sockets with **4403**. With sockets spread across
instances, the revoking request (a plain Function) can't reach them directly, so it publishes a
**control message**: `XADD ctrl:{session_id} {type:"revoked"}` (or a `user:{uid}:ctrl` channel for
"revoke all"). Each instance's session reader watches the control stream and, on `revoked`, closes
its local socket with **4403**. Same guarantee as the base spec; delivered over the bus.

## 6. Reconnect & resume are mandatory here (hardening base §4.3)

In the base spec, resume/replay was a v2 "nice to have." On Vercel it is **load-bearing**, because
**every** long session is forcibly cut when the Function hits `maxDuration` (≤30 min). The flow:

1. Socket approaches `maxDuration` → server sends `{"type":"reconnect_hint","in_sec":N}` (advisory)
   then closes **1000**, or the platform cuts it.
2. Agent re-runs §4.1 auth, then sends `{"type":"resume","id":"r1","session_id":"ses_…","last_seq":42}`.
3. The new instance reads `sess:{id}` from the entry after `seq=42` (`XRANGE (start, +`), replays
   those events to whichever side is catching up, and resumes. The Redis stream is the source of
   truth, so it doesn't matter that a *different* instance now holds the socket.
4. The web client reconnects the same way (re-ticket → `/client` → resume per watched session).

Streams are trimmed (`XADD … MAXLEN ~ N` or `MINID` by age) to bound history to a recent window;
a resume older than the retained window returns `success:false` and the client does a fresh sync.

## 7. Data model deltas

- **Postgres (Supabase):** unchanged from base §6 — `device_codes`, `agent_tokens`,
  `agent_sessions`. `agent_sessions.last_seq` is still the durable high-water mark.
- **Redis (new):** `sess:{id}` (event stream), `sess:{id}:cmd` (command stream),
  `ctrl:{id}` / `user:{uid}:ctrl` (control), `presence:{id}` (TTL heartbeat),
  `user:{uid}:sessions` (set), `ticket:{opaque}` (single-use `/client` ticket, short TTL),
  `devauth:{user_code}` (optional fast lookup for device approval). All ephemeral/operational;
  Postgres remains the system of record.

## 8. Frontend integration (same seam as base §8)

Identical: a `WebSocketPiService implements PiService` behind `VITE_PI_SERVER_URL`, a `/device`
approval route, and Settings → Agents. The only practical change is that `VITE_PI_SERVER_URL` can
now point at the **same origin** as the SPA (e.g. `wss://pi-rimokon.vercel.app/client`) instead of
a separate `agents.*` host — which also sidesteps cross-origin concerns on the ticket fetch.

## 9. Phasing for this variant

- **v1 (MVP):** device flow + `/agent` + `/client` as Vercel WS Functions; **Redis Streams relay,
  presence, and resume/replay from day one** (not optional here); per-function `maxDuration`
  tuned to the plan. Reconnect-with-replay is the steady state, not an edge case.
- **v2:** tune stream retention/trim policy and heartbeat cadence under load; consider Socket.IO's
  Redis adapter if we adopt Socket.IO; multi-session-per-token; regional/latency tuning.
- **Out of scope (same as base):** the agent-side command/event *vocabulary* (Pi's own RPC doc).

## 10. Trade-offs — standalone Node server vs Vercel WebSockets

> A fuller, dimension-by-dimension breakdown lives in
> [`agent-endpoint-comparison.md`](./agent-endpoint-comparison.md). Quick matrix:

| Dimension | Standalone Node server (base spec) | Vercel WebSockets (this spec) |
|---|---|---|
| **Ops surface** | A second service to deploy, scale, monitor, secure | None — same Vercel project as the SPA |
| **Connection lifetime** | Unbounded (you control the process) | **Capped at ≤30 min**; forced reconnects |
| **Cross-instance routing** | Optional — single instance works for v1 (in-memory) | **Mandatory external bus (Redis) from v1** |
| **Resume/replay** | Can defer to v2 | **Required in v1** (duration cap guarantees cuts) |
| **Cost model** | Always-on instance (pay for idle) | **Active-CPU only** (idle sockets ~free) |
| **Scaling** | You manage it (or a PaaS) | Automatic (Fluid) |
| **Cold starts** | None (warm process) | Possible on the function path |
| **Same-origin `wss`** | No — separate host + CORS/Origin setup | Yes — `wss://<same-app>/client` |
| **Best when** | Long-lived, chatty, latency-sensitive sessions; full control | Lower ops, spiky/idle agents, staying all-in on Vercel |

**Recommendation to discuss:** Vercel WS is attractive for **operational simplicity and cost** if
we're comfortable making **reconnect-with-replay a first-class, always-exercised path** and taking
a **Redis dependency** on day one. The standalone server is the safer pick if we expect **long,
continuous, low-latency** agent sessions where a 30-min hard cut and cold starts would hurt. A
pragmatic middle path: **adopt this Vercel design for v1** (cheapest to ship, no new service) and
keep the standalone server as the escape hatch if duration caps or latency become a problem —
because §3's auth and the Pi RPC envelope are identical, **only the transport host would change.**

## 11. Open questions

1. **Redis provider** — Upstash (serverless, HTTP/Redis, pairs well with Vercel) vs another managed
   Redis? Affects the `XREAD BLOCK` reader pattern (needs a TCP connection, not just HTTP).
2. **`maxDuration`** — set to the 1800 s max, or shorter to bound cost and exercise reconnect more
   often? (Shorter = more reconnect churn but cheaper/sturdier.)
3. **Socket.IO vs raw `ws`** — Socket.IO gives a Redis adapter + reconnection for free but adds its
   own framing on top of our Pi records; raw `ws` keeps the wire exactly as specced. Lean `ws`.
4. **Plan** — 30-min durations need Pro/Enterprise. Confirm the target plan before committing to
   the duration assumption.
