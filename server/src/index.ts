import 'dotenv/config'
import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'

/**
 * Server bootstrap. One `http.Server` will host both the Express routes and
 * (from M2) the `WebSocketServer({ noServer: true })` upgrade routing for
 * `/agent` and `/client`. For M0 it serves HTTP only.
 */
const config = loadConfig()
const app = createApp()
const server = createServer(app)

server.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[pi-remote-server] listening on :${config.PORT}`)
})
