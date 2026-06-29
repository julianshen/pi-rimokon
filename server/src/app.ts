import express, { type Express } from 'express'
import type { AuthContext } from './auth/context.ts'
import { healthRouter } from './http/health.ts'
import { oauthRouter } from './http/oauth.ts'

/**
 * Build the Express app. Kept separate from the server bootstrap (index.ts) so
 * routes are unit-testable without binding a port. When an {@link AuthContext}
 * is provided the device-flow + JWKS routes (M1) are mounted; the WebSocket
 * upgrade handler (M2) attaches onto the same server in index.ts.
 */
export function createApp(ctx?: AuthContext): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json())
  app.use(healthRouter())
  if (ctx) app.use(oauthRouter(ctx))
  return app
}
