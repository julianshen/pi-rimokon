import { Router } from 'express'
import { PROTOCOL_VERSION } from '../../../shared/protocol.ts'

/**
 * Liveness endpoint. `GET /healthz` → 200 with the protocol version the server
 * speaks (also doubles as a smoke test that the shared contract imports here).
 */
export function healthRouter(): Router {
  const router = Router()
  router.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok', protocol: PROTOCOL_VERSION })
  })
  return router
}
