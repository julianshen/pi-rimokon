# pi-remote-control — Pi extension

Adds a **`/remote-control`** command to a live Pi session. Running it connects
this session to the [Pi Remote Server](../server) so a browser (the Pi Remote
SPA) can **observe and steer** it — the agent side of the `/agent` protocol
(spec §3/§4).

It's the counterpart to the server: the server implements auth + transport +
broker; this bridges Pi's in-session runtime to it.

## What `/remote-control` does

1. **Auth** — runs the RFC 8628 device flow against the server: shows a
   `user_code` + the `/device` URL (via `ctx.ui`), you approve in the browser,
   and it stores a rotating agent token under `~/.pi/agent/remote-control/`.
2. **Connect** — opens `wss://<server>/agent`, does the `hello`/`ready`
   handshake, and advertises this session (`accept_task`, repo, idle/busy).
3. **Bridge** — forwards session events (agent messages, tool executions,
   idle↔busy) to your browser, and applies inbound commands: `prompt` /
   `steer` → `pi.sendUserMessage`, `stop` → `ctx.abort()`. Auto-reconnects.

## Install

Copy (or symlink) into a Pi extensions dir, then `npm install` its deps:

```bash
cp -r extension ~/.pi/agent/extensions/pi-remote-control
cd ~/.pi/agent/extensions/pi-remote-control && npm install --omit=dev   # installs `ws`
```

Or reference it from `settings.json` under `"extensions"` / `"packages"`.

## Configure

| Env | Default | Meaning |
|-----|---------|---------|
| `PI_REMOTE_SERVER_URL` | `wss://agents.jlnshen.com` | Pi Remote Server origin (wss://) |
| `PI_REMOTE_CLIENT_ID`  | `pi-agent-cli` | OAuth client id sent in the device flow |

## Use

In a Pi session: `/remote-control` → approve the code in the browser → the
session appears in Pi Remote; steer it from there. The footer status line shows
connection state.

Point it at a specific server by passing the endpoint (overrides
`PI_REMOTE_SERVER_URL` and the default for that invocation):

```
/remote-control wss://agents.jlnshen.com
```

## Develop

```bash
cd extension
npm install
npm run typecheck
npm run coverage   # core (auth + connection) unit-tested, ≥85% gate
```

The Pi-agnostic core (`src/auth.ts`, `src/connection.ts`, `src/config.ts`,
`src/protocol.ts`) is unit-tested with fakes. `index.ts` is the thin Pi adapter
(runs only inside a real Pi session). Notes for wiring against a specific Pi
build: the agent-event → frame mapping in `index.ts` uses best-effort message
shapes, and `pick_option` is mapped to a plain user message (Pi exposes no
dedicated "answer option" API) — adjust there if your Pi version differs.
