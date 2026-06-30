# Deploy the Pi Remote Server to local K3s + Cloudflare Tunnel

Runs the **server** in your K3s cluster and exposes it at
`wss://agents.jlnshen.com` through a **Cloudflare Tunnel** — no inbound ports,
no public IP. The SPA stays on Vercel; the database stays on Supabase.

```
 Browser ─ wss /client + https /client/ticket ─┐
 Agent   ─ wss /agent ─────────────────────────┤  Cloudflare edge (TLS)
                                                ▼   ↕ outbound tunnel
                            ┌──────────── K3s cluster (namespace: pi-remote) ───────────┐
                            │  cloudflared ─► Service pi-remote-server:8787 ─► server   │
                            └───────────────────────────────────────────────┼──────────┘
 Vercel ─ static SPA (VITE_PI_SERVER_URL=wss://agents.jlnshen.com)           ▼  Supabase (Auth + Postgres)
```

## Prerequisites

- A running **K3s** cluster and `kubectl` pointed at it.
- **Docker** (or nerdctl/buildah) to build the image.
- A **Supabase** project (Auth + Postgres) — you have this from M1.
- A **Cloudflare** account with a zone for your domain (e.g. `jlnshen.com`).

## 1. Build the image and import it into K3s

K3s uses containerd, so a locally-built image must be imported into its image
store (no registry needed). **Build from the repo root** (the Dockerfile needs
`shared/` in context):

```bash
# from the repo root
docker build -t pi-remote-server:0.1.0 -f server/Dockerfile .
# Import into the k8s.io containerd namespace (where the kubelet looks for
# images). `k3s ctr` defaults to k8s.io, but pass -n explicitly to be sure.
docker save pi-remote-server:0.1.0 | sudo k3s ctr -n k8s.io images import -
```

> Multi-node cluster? Import on every node, or push to a registry (Docker Hub /
> GHCR / a local registry) and set `image:` accordingly in the manifests with
> `imagePullPolicy: IfNotPresent`.

## 2. Generate the signing keypair (once)

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out agent_priv.pem
openssl rsa -in agent_priv.pem -pubout -out agent_pub.pem
```

## 3. Server secret

```bash
kubectl apply -f deploy/k8s/00-namespace.yaml
cp deploy/k8s/10-server-secret.example.yaml server-secret.yaml
# edit server-secret.yaml: paste DATABASE_URL, SUPABASE_URL, ALLOWED_ORIGIN,
# and the two PEM blocks (agent_priv.pem / agent_pub.pem). Keep it OUT of git.
kubectl apply -f server-secret.yaml
```

## 4. Cloudflare Tunnel (dashboard / token mode — simplest for K8s)

1. Cloudflare **Zero Trust** dashboard → **Networks → Tunnels → Create a tunnel**
   → **Cloudflared** → name it `pi-remote`.
2. On the install screen, **copy the tunnel token** (the long string after
   `--token` in the shown command). You don't run that command — the token goes
   into the cluster:
   ```bash
   kubectl -n pi-remote create secret generic cloudflared-token \
     --from-literal=token='<PASTE_TUNNEL_TOKEN>'
   ```
3. In the tunnel's **Public Hostnames** tab, **Add a public hostname**:
   - **Subdomain/Domain:** `agents.jlnshen.com` (Cloudflare creates the DNS record for you)
   - **Service → Type:** `HTTP`
   - **Service → URL (host:port):** `pi-remote-server.pi-remote.svc.cluster.local:8787`
     (the Type dropdown supplies the scheme, so enter host:port only here; the
     equivalent config-file form is `service: http://pi-remote-server.pi-remote.svc.cluster.local:8787`).
   - (Additional settings → leave defaults; Cloudflare proxies WebSockets automatically.)
4. Save. The tunnel shows **HEALTHY** once the cloudflared pods connect (step 5).

> Prefer config-as-code over the dashboard? Use credentials-file mode instead:
> mount the tunnel credentials JSON + a `config.yml` (ingress → the Service DNS)
> via a Secret/ConfigMap. The dashboard token path above is the least-friction
> option and is what `40-cloudflared.yaml` expects.

## 5. Deploy

```bash
kubectl apply -f deploy/k8s/20-server-deployment.yaml
kubectl apply -f deploy/k8s/30-server-service.yaml
kubectl apply -f deploy/k8s/40-cloudflared.yaml
kubectl -n pi-remote rollout status deploy/pi-remote-server
kubectl -n pi-remote rollout status deploy/cloudflared
```

Verify, in-cluster then through the edge:

```bash
kubectl -n pi-remote port-forward svc/pi-remote-server 8787:8787 &
curl -fsS localhost:8787/healthz   # {"status":"ok","protocol":"pi.rpc/1"}
curl -fsS localhost:8787/metrics   # live + cumulative counts
curl -fsS https://agents.jlnshen.com/healthz   # 200 through Cloudflare
```

## 6. Point the SPA at it (Vercel)

Set `VITE_PI_SERVER_URL=wss://agents.jlnshen.com` in the Vercel project env and
redeploy. With the var unset the SPA stays on `MockPiService`.

## 7. End-to-end smoke test

1. `pi login` on a dev box → prints a `user_code` + the `/device` URL.
2. Open the URL in Pi Remote (signed in) → **Authorize**.
3. The agent appears in the session list (`session_online`); steer it → events stream back.
4. `kubectl -n pi-remote rollout restart deploy/pi-remote-server` → sockets drain
   with a `reconnect_hint` (close 1001); both sides auto-reconnect in a few seconds.
   Revoke from **Settings → Agents** closes the live socket immediately (4403).

## Operations

- **Logs:** `kubectl -n pi-remote logs -f deploy/pi-remote-server` (and `deploy/cloudflared`).
- **Metrics:** `GET /metrics` → `{agents_live, clients_live, *_total, routing_errors_total}`.
- **Scaling:** keep `pi-remote-server` at **replicas: 1** (in-memory broker, spec v1).
  `cloudflared` can scale freely. Updating the image: re-run step 1 (new tag),
  bump `image:` in the deployment, `kubectl apply`.
- **Caveat:** if your K3s node reboots, re-import the image (containerd's store is
  local) unless you used a registry.
