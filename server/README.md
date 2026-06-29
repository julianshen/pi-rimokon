# Pi Remote Server

Standalone Node/TypeScript service that hosts the `/agent` + `/client` WebSocket
endpoints and RFC 8628 device-flow auth described in
[`docs/agent-endpoint-spec.md`](../docs/agent-endpoint-spec.md). Built per the
[implementation plan](../docs/agent-endpoint-implementation-plan.md).

## Status

- **M0** — scaffold, schema, shared contract; `GET /healthz`.
- **M1** — RFC 8628 device flow + RS256 agent tokens (rotating refresh w/ reuse
  revocation), `/oauth/*` + JWKS.
- **M2** — the `/agent` WebSocket: upgrade auth (`Authorization: Bearer` +
  `hello.token` fallback), `hello`/`ready` handshake with protocol negotiation +
  availability (`accept_task`), framing guards, ping/pong heartbeat, session
  lifecycle, and revocation tear-down (4403). A fake-agent harness drives it.

Next: `/client` + broker (M3), frontend integration (M4), deployment (M5).

### Fake agent (manual testing)

```bash
# with a server running and an agent token from the device flow:
npm run fake-agent -- ws://127.0.0.1:8787/agent "<agent-token>"        # emits demo events
npm run fake-agent -- ws://127.0.0.1:8787/agent "<agent-token>" --idle # idle, accept_task=true
```

## Layout

```
server/
  src/
    index.ts            # http bootstrap (ws upgrade routing lands in M2)
    app.ts              # Express app factory
    config.ts           # fail-fast env schema (zod)
    http/health.ts      # GET /healthz
    db/
      client.ts         # pg Pool factory
      migrate.ts        # pure migration loader/applier (testable)
      runMigrate.ts     # `npm run migrate` CLI
      migrations/*.sql  # ordered DDL (spec §6)
  test/                 # vitest (node env)
../shared/protocol.ts   # wire contract shared with the SPA
```

## Develop

```bash
cd server
npm install
cp .env.example .env     # fill in DATABASE_URL
npm run dev              # tsx watch on :PORT (default 8787); loads .env via dotenv
npm test                 # vitest run
npm run coverage         # vitest + ≥85% coverage gate on core logic
npm run typecheck        # tsc --noEmit
npm run migrate          # apply migrations to DATABASE_URL
```

Migration SQL is exercised in tests against in-process Postgres (pglite), so the
schema is validated without a live database. Supabase Row-Level Security
policies (spec §6/§7) are applied separately against a live Supabase project.
