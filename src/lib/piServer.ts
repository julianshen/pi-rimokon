import { supabase } from './supabase'

/** Derive the HTTPS API origin from the `wss://` server URL (spec §8). */
export function toHttpBase(url: string | undefined): string | undefined {
  return url ? url.replace(/^ws/, 'http').replace(/\/$/, '') : undefined
}

/** The Pi Remote Server origin (wss://), or undefined when not configured. */
export const piServerUrl = import.meta.env.VITE_PI_SERVER_URL

/** The matching HTTPS origin for REST calls (ticket, device, agents). */
export const piHttpBase = toHttpBase(piServerUrl)

/** Current Supabase access token, for authenticating browser→server calls. */
export async function piAccessToken(): Promise<string | null> {
  return (await supabase?.auth.getSession())?.data.session?.access_token ?? null
}
