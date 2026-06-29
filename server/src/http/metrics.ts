import { Router } from 'express'
import type { Broker } from '../broker/registry.ts'

/**
 * `GET /metrics` — live + cumulative broker counts (spec §7 observability):
 * connected agents/clients, total connections, and routing errors. JSON for
 * easy scraping; unauthenticated (no secrets, operational counts only).
 */
export function metricsRouter(broker: Broker): Router {
  const router = Router()
  router.get('/metrics', (_req, res) => {
    res.status(200).json(broker.stats())
  })
  return router
}
