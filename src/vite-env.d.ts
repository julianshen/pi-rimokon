/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://xxxx.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anonymous (publishable) API key — safe to ship in the browser. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Pi Remote Server origin as a wss:// URL; unset → MockPiService. */
  readonly VITE_PI_SERVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
