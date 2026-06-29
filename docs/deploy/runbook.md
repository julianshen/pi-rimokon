# Deployment runbook — Pi Remote Server (M5)

Brings the `/agent` + `/client` backend live behind a Cloudflare Tunnel at
`agents.jlnshen.com`, with the SPA on Vercel pointed at it. See
[`agent-endpoint-spec.md` §8.1](../agent-endpoint-spec.md) for the topology.

```
 Browser ─ wss /client + https /client/ticket ─┐
 Agent   ─ wss /agent ─────────────────────────┤ Cloudflare edge (TLS)
                                                ▼  ↕ outbound tunnel (cloudflared)
                                   self-hosted Node server :8787 ─► Supabase
 Vercel ─ static SPA + /device page (VITE_PI_SERVER_URL=wss://agents.jlnshen.com)
```

## 1. Generate the signing keypair (once)

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out agent_priv.pem
openssl rsa -in agent_priv.pem -pubout -out agent_pub.pem
```

Keep `agent_priv.pem` secret. The public key is published at `/.well-known/jwks.json`.

## 2. Server env

Create `/etc/pi-remote/server.env` (root-owned, `chmod 600`):

```ini
PORT=8787
DATABASE_URL=postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres
JWT_ISSUER=https://agents.jlnshen.com
SUPABASE_URL=https://<ref>.supabase.co
ALLOWED_ORIGIN=https://pi-rimokon.vercel.app
# PEMs as single-line values with literal \n (or use a process manager that
# supports multi-line). e.g.:
AGENT_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
AGENT_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
# Optional hardening overrides (defaults shown):
# MAX_SESSIONS_PER_USER=20
# MAX_CLIENTS_PER_USER=10
# WS_RATE_MAX=120
# WS_RATE_WINDOW_MS=1000
```

The server fails fast with a clear message if any required value is missing.

## 3. Database

```bash
cd /opt/pi-remote/server && npm ci && npm run migrate   # creates the spec §6 tables
```

Apply Supabase Row-Level Security separately (the server uses the service role;
RLS guards any direct client reads — spec §6).

## 4. Run it

```bash
sudo cp docs/deploy/pi-remote-server.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now pi-remote-server
curl -fsS http://localhost:8787/healthz        # {"status":"ok","protocol":"pi.rpc/1"}
curl -fsS http://localhost:8787/metrics         # live + cumulative counts
```

## 5. Cloudflare Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create pi-remote
cloudflared tunnel route dns pi-remote agents.jlnshen.com
cp docs/deploy/cloudflared-config.yml ~/.cloudflared/config.yml   # set <tunnel-id>
sudo cloudflared service install        # run cloudflared as a service
```

Verify end to end: `https://agents.jlnshen.com/healthz` returns 200 through the edge.

## 6. Frontend (Vercel)

Set `VITE_PI_SERVER_URL=wss://agents.jlnshen.com` in the Vercel project env and
redeploy. The SPA derives the HTTPS API origin by swapping the scheme. With the
var unset the app stays on `MockPiService`.

## 7. Smoke test (acceptance)

1. On a dev machine: `pi login` → prints a `user_code` + the `/device` URL.
2. Open the URL in Pi Remote (signed in) → **Authorize**.
3. Agent comes online; the browser's session list shows it (`session_online`).
4. Steer it → events stream back live.
5. `sudo systemctl restart pi-remote-server` → sockets drain with a
   `reconnect_hint` (close 1001); both the agent and browser auto-reconnect
   within a few seconds. Revoke from **Settings → Agents** closes the live
   socket immediately (4403).

## Operations

- **Logs:** `journalctl -u pi-remote-server -f`.
- **Metrics:** `GET /metrics` → `{agents_live, clients_live, *_total, routing_errors_total}`.
- **Limits:** per-connection frame rate (1008 on breach), max sessions/clients
  per user (1013), 1 MiB max frame (4413) — tune via env.
- **Rollback:** `systemctl stop`; the SPA falls back gracefully (sessions just
  go offline) and reconnects when the server returns.
