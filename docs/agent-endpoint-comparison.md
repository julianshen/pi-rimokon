# `/agent` transport comparison: Standalone Node server vs Vercel WebSockets

Side-by-side comparison of the two `/agent` designs:

- **A — Standalone Node server:** [`agent-endpoint-spec.md`](./agent-endpoint-spec.md)
- **B — Vercel WebSockets (Fluid compute):** [`agent-endpoint-spec-vercel.md`](./agent-endpoint-spec-vercel.md)

Both share identical **identity (RFC 8628 device flow)**, **token model**, **Pi RPC envelope**,
**framing**, **close codes**, and **broker ownership rules**. They differ only in *where the socket
runs* and the consequences that follow. Tables are grouped by concern.

## 0. TL;DR

| | **A · Standalone Node server** | **B · Vercel WebSockets** |
|---|---|---|
| One-liner | A long-lived service you run, full control | WS Functions in the existing Vercel app, no new service |
| Ship-cost | Stand up + operate a new service | Add functions + a Redis dependency |
| Best when | Long, chatty, latency-sensitive sessions | Spiky/idle agents, minimal ops, all-in on Vercel |
| Biggest catch | You own uptime, scaling, idle cost | 30-min connection cap + mandatory external relay |

## 1. Hosting & operations

| Aspect | A · Standalone | B · Vercel |
|---|---|---|
| Runtime | Always-on Node process (`ws`/`uWebSockets`) | Fluid-compute Function (`ws`+Express, or Socket.IO) |
| Where it lives | New service (own repo or `server/` workspace) | Same Vercel project as the SPA |
| Deploy surface | Separate pipeline + host (Fly/Render/EC2/…) | `git push` → Vercel, same as today |
| Ops burden | You own uptime, patching, scaling, monitoring | Platform-managed |
| Cold starts | None (process stays warm) | Possible on the function path |
| Scaling | Manual / PaaS autoscaler you configure | Automatic (Fluid) |
| TLS / domain | You set up `agents.*` host + certs | Inherited from the Vercel app |

## 2. Connection model

| Aspect | A · Standalone | B · Vercel |
|---|---|---|
| Max connection lifetime | **Unbounded** (you control the process) | **Capped**: 800 s default, **≤1800 s (30 min)** Pro/Enterprise, per-function (beta) |
| Instance affinity | One process holds all sockets (v1) | **Socket pinned to one instance**; peers may be elsewhere |
| Forced reconnects | None (only on deploy/restart) | **Routine** — every long session is cut at `maxDuration` |
| Heartbeat purpose | Liveness only | Liveness; each ping is billable active-CPU |

## 3. Routing (agent ↔ browser)

| Aspect | A · Standalone | B · Vercel |
|---|---|---|
| v1 mechanism | **In-process** per-user registry (a Map) | **Redis Streams** relay — required from v1 |
| Cross-instance | Not needed at v1; add a bus at v2 for scale | **Mandatory day one** (sockets are pinned apart) |
| Command path (web→agent) | Direct in-memory handoff | `XADD sess:{id}:cmd` → agent's instance reads |
| Event path (agent→web) | Direct in-memory fan-out | `XADD sess:{id}` → watcher instances fan out |
| Presence | In-memory registry state | Redis `presence:{id}` key w/ heartbeat TTL |
| Ownership enforcement | Same — per-user, no cross-user routing | Same — enforced in code; RLS on direct reads |

## 4. Resume, replay & durability

| Aspect | A · Standalone | B · Vercel |
|---|---|---|
| Resume/replay priority | **v2** (nice-to-have; v1 just rebinds) | **v1 requirement** (duration cap guarantees cuts) |
| Event history store | Deferred to v2 (in-memory ring → bus) | **Redis stream `sess:{id}`** doubles as durable log |
| `seq` ordering | Per-session monotonic (agent-assigned) | Same; persisted as Redis stream-ID order |
| High-water mark | `agent_sessions.last_seq` (Postgres) | Same |
| Replay window | Bounded ring (v2) | Stream trimmed by `MAXLEN`/`MINID`; older → full resync |

## 5. Auth (identical — shown for completeness)

| Aspect | A · Standalone | B · Vercel |
|---|---|---|
| Device flow (RFC 8628) | ✅ `device/code` → approve → `device/token` | ✅ same, served as Vercel Functions |
| Request encoding | form-urlencoded (RFC); approve = custom JSON | identical |
| Agent token | RS256 JWT `aud:"pi-agent"` + rotating refresh | identical |
| Agent upgrade auth | `Authorization: Bearer` on upgrade | identical (Functions get upgrade headers) |
| Browser auth | Single-use `/client/ticket` (no WS headers) | identical |
| Revocation | Check on connect/refresh **+ close live (4403)** | same; cross-instance via Redis `ctrl:` stream |

## 6. Dependencies & data

| Aspect | A · Standalone | B · Vercel |
|---|---|---|
| Identity | Supabase Auth (GitHub) | same |
| System of record | Supabase Postgres: `device_codes`, `agent_tokens`, `agent_sessions` | same |
| Extra infra | None at v1 (bus only at v2 for scale) | **Redis (e.g. Upstash) from v1**: streams, presence, tickets, control |
| New failure domain | The service itself | Redis availability + per-instance limits |

## 7. Cost

| Aspect | A · Standalone | B · Vercel |
|---|---|---|
| Billing model | Always-on instance(s) — **pay for idle** | **Active-CPU only** — idle sockets ≈ free |
| Idle agents | Still cost (process is up) | Cheap |
| Busy/chatty agents | Flat (already paid for) | Pay per processing burst + Redis ops |
| Added cost | Hosting bill | Redis plan |

## 8. Latency & performance

| Aspect | A · Standalone | B · Vercel |
|---|---|---|
| Agent↔web hop | In-process (lowest) at v1 | Through Redis (one extra hop) always |
| Tail latency | Predictable warm process | Cold start + reconnect churn add jitter |
| Throughput ceiling | Single process until you shard | Per-instance limits; relay throughput = Redis |
| Same-origin `wss` | No — separate host (+ Origin/CORS on ticket) | Yes — `wss://<same-app>/client`, no CORS |

## 9. When to choose which

| Choose **A · Standalone** if… | Choose **B · Vercel** if… |
|---|---|
| Sessions are long, continuous, latency-sensitive | Sessions are spiky/mostly idle |
| A 30-min hard cut is unacceptable | Reconnect-with-replay is fine as the steady state |
| You want lowest hop latency / full control | You want zero new ops surface |
| You'd rather not add Redis at v1 | You're happy taking a Redis dependency |
| Idle cost is acceptable for predictability | You want idle to be ~free |

## 10. Recommendation

Because **auth and the Pi RPC envelope are identical**, the transport is the *only* thing that
changes between A and B — so this is a reversible decision. The pragmatic path: **ship B (Vercel)
for v1** to avoid standing up and operating a new service, *provided* we accept (1) making
**reconnect-with-replay a first-class, always-exercised path** and (2) a **Redis dependency** from
day one, and we're on a **Pro/Enterprise** plan for the 30-min duration. Keep **A** as the
escape hatch if the duration cap, cold starts, or the extra Redis hop ever hurt — switching back
touches only the transport layer, not identity or protocol.
