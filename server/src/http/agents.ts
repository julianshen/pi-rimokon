import { type Request, type RequestHandler, type Response, Router } from 'express'
import type { AuthContext } from '../auth/context.ts'
import { revokeAgentFamily } from '../auth/deviceFlow.ts'
import { SupabaseAuthError } from '../auth/supabaseJwt.ts'
import { agentTokens } from '../db/repositories.ts'

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
      console.error('[agents] unexpected error', err)
      res.status(500).json({ error: 'server_error' })
    })
  }
}

/**
 * Settings → Agents (spec §8): list + revoke the signed-in user's agent tokens.
 * Authenticated by the Supabase JWT (these are browser calls, not agent calls).
 */
export function agentsRouter(ctx: AuthContext): Router {
  const router = Router()

  router.get(
    '/agent/tokens',
    handle(async (req, res) => {
      const token = bearer(req)
      if (!token) {
        res.status(401).json({ error: 'invalid_token' })
        return
      }
      const { sub } = await ctx.verifySupabaseToken(token)
      const rows = await agentTokens.listByUser(ctx.db, sub)
      res.status(200).json({
        tokens: rows.map((r) => ({
          jti: r.jti,
          family_id: r.family_id,
          label: r.label,
          scopes: r.scopes,
          created_at: r.created_at,
          last_seen_at: r.last_seen_at,
          revoked_at: r.revoked_at,
        })),
      })
    }),
  )

  router.post(
    '/agent/tokens/revoke',
    handle(async (req, res) => {
      const token = bearer(req)
      if (!token) {
        res.status(401).json({ error: 'invalid_token' })
        return
      }
      const { sub } = await ctx.verifySupabaseToken(token)
      const familyId = String(req.body?.family_id ?? '')
      // Only revoke a family the requesting user actually owns.
      if (!familyId || !(await agentTokens.familyBelongsToUser(ctx.db, familyId, sub))) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      await revokeAgentFamily(ctx, familyId)
      res.status(200).json({})
    }),
  )

  return router
}
