import { type Request, type RequestHandler, type Response, Router } from 'express'
import type { AuthContext } from '../auth/context.ts'
import type { TicketStore } from '../broker/tickets.ts'
import { SupabaseAuthError } from '../auth/supabaseJwt.ts'

function bearer(req: Request): string | undefined {
  return /^Bearer\s+(.+)$/i.exec((req.header('authorization') ?? '').trim())?.[1]?.trim()
}

function handle(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res) => {
    fn(req, res).catch((err: unknown) => {
      if (err instanceof SupabaseAuthError) {
        res.status(401).json({ error: 'invalid_token' })
        return
      }
      // eslint-disable-next-line no-console
      console.error('[client] unexpected error', err)
      res.status(500).json({ error: 'server_error' })
    })
  }
}

/**
 * `POST /client/ticket` (spec §5.1): the SPA exchanges its Supabase session for
 * a short-lived, single-use ticket it then presents on the `/client` WS URL
 * (browsers can't set `Authorization` on a WS upgrade).
 */
export function clientRouter(ctx: AuthContext, tickets: TicketStore): Router {
  const router = Router()
  router.post(
    '/client/ticket',
    handle(async (req, res) => {
      const token = bearer(req)
      if (!token) {
        res.status(401).json({ error: 'invalid_token' })
        return
      }
      const { sub } = await ctx.verifySupabaseToken(token)
      const { ticket, expiresIn } = tickets.issue(sub)
      // The ticket is a redeemable secret — never let it be cached.
      res.set('Cache-Control', 'no-store')
      res.status(200).json({ ticket, expires_in: expiresIn })
    }),
  )
  return router
}
