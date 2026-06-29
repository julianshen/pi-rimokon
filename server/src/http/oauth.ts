import { type Request, type RequestHandler, type Response, Router } from 'express'
import express from 'express'
import type { AuthContext } from '../auth/context.ts'
import {
  approveDevice,
  issueDeviceCode,
  OAuthError,
  revokeToken,
  tokenGrant,
} from '../auth/deviceFlow.ts'
import { jwks } from '../auth/keys.ts'
import { SupabaseAuthError } from '../auth/supabaseJwt.ts'

/** Wrap an async handler so thrown OAuthErrors map to `{ error }` responses. */
function handle(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res) => {
    fn(req, res).catch((err: unknown) => {
      if (err instanceof OAuthError) {
        res.status(err.httpStatus).json({ error: err.error })
        return
      }
      // eslint-disable-next-line no-console
      console.error('[oauth] unexpected error', err)
      res.status(500).json({ error: 'server_error' })
    })
  }
}

function bearer(req: Request): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec((req.header('authorization') ?? '').trim())
  return match?.[1]?.trim()
}

/** All device-flow + token + JWKS routes (spec §3). */
export function oauthRouter(ctx: AuthContext): Router {
  const router = Router()
  const form = express.urlencoded({ extended: false })

  // The SPA approval page is a different origin from the server (spec §7/§8.1),
  // and its JSON+Authorization request triggers a CORS preflight.
  if (ctx.allowedOrigin) {
    const origin = ctx.allowedOrigin
    router.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', origin)
      res.header('Vary', 'Origin')
      res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      if (req.method === 'OPTIONS') {
        res.sendStatus(204)
        return
      }
      next()
    })
  }

  router.get('/.well-known/jwks.json', (_req, res) => {
    res.status(200).json(jwks(ctx.keys))
  })

  router.post(
    '/oauth/device/code',
    form,
    handle(async (req, res) => {
      const result = await issueDeviceCode(ctx, {
        clientId: String(req.body.client_id ?? ''),
        scope: String(req.body.scope ?? 'agent'),
      })
      res.status(200).json(result)
    }),
  )

  // Our own endpoint (RFC leaves approval undefined) — JSON + Supabase bearer.
  router.post(
    '/oauth/device/approve',
    handle(async (req, res) => {
      const token = bearer(req)
      if (!token) throw new OAuthError('invalid_token', 401)
      const decision = req.body?.decision === 'deny' ? 'deny' : 'approve'
      try {
        const result = await approveDevice(ctx, {
          supabaseToken: token,
          userCode: String(req.body?.user_code ?? ''),
          decision,
        })
        res.status(200).json(result)
      } catch (err) {
        // Only genuine token-verification failures are 401; OAuth + unexpected
        // errors propagate to their own mappings (4xx / 500).
        if (err instanceof SupabaseAuthError) throw new OAuthError('invalid_token', 401)
        throw err
      }
    }),
  )

  router.post(
    '/oauth/device/token',
    form,
    handle(async (req, res) => {
      const bundle = await tokenGrant(ctx, {
        grantType: String(req.body.grant_type ?? ''),
        clientId: req.body.client_id ? String(req.body.client_id) : undefined,
        deviceCode: req.body.device_code ? String(req.body.device_code) : undefined,
        refreshToken: req.body.refresh_token ? String(req.body.refresh_token) : undefined,
      })
      res.status(200).json(bundle)
    }),
  )

  router.post(
    '/oauth/revoke',
    form,
    handle(async (req, res) => {
      await revokeToken(ctx, req.body.token ? String(req.body.token) : undefined)
      res.status(200).json({})
    }),
  )

  return router
}
