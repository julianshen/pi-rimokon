import express, { type Express } from 'express'
import { healthRouter } from './http/health.ts'

/**
 * Build the Express app. Kept separate from the server bootstrap (index.ts) so
 * routes are unit-testable without binding a port. Device-flow + ticket routes
 * (M1/M3) and the WebSocket upgrade handler (M2) attach onto this skeleton.
 */
export function createApp(): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json())
  app.use(healthRouter())
  return app
}
