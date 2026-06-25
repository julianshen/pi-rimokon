// Supabase client — the auth transport for Google / GitHub sign-in.
//
// Both values are public: the URL identifies the project and the anon key is a
// publishable, RLS-gated key meant to ship in the browser. They come from
// Vite env vars (see `.env.example`) so deployments stay configurable without
// code changes. If either is missing we export `null` rather than throwing, so
// the app can render a "needs configuration" notice instead of a white screen.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        // Persist the session across reloads and finish the OAuth redirect by
        // reading the code/token Supabase appends to the return URL.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
