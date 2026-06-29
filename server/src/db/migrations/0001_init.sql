-- M0 — initial schema for the Pi Remote Server (spec §6).
-- Portable, dependency-free DDL: tables + indexes only. Supabase Row-Level
-- Security policies (spec §6/§7, which reference auth.uid()) are applied
-- separately when wired to a live Supabase project, since they depend on the
-- Supabase auth schema that does not exist in a plain Postgres / test database.

-- Device Authorization Grant codes (RFC 8628 / spec §3).
CREATE TABLE IF NOT EXISTS device_codes (
  device_code_hash TEXT PRIMARY KEY,
  user_code        TEXT NOT NULL UNIQUE,
  client_id        TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  user_id          UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  last_polled_at   TIMESTAMPTZ,
  -- spec §6 calls this `interval`; renamed to avoid the reserved INTERVAL type.
  poll_interval    INTEGER NOT NULL DEFAULT 5
);
-- (no extra index on user_code: the UNIQUE constraint already creates one.)

-- Issued agent access tokens / token families (spec §3.2).
CREATE TABLE IF NOT EXISTS agent_tokens (
  jti          TEXT PRIMARY KEY,
  family_id    TEXT NOT NULL,
  user_id      UUID NOT NULL,
  label        TEXT,
  scopes       TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS agent_tokens_user_id_idx ON agent_tokens (user_id);
CREATE INDEX IF NOT EXISTS agent_tokens_family_id_idx ON agent_tokens (family_id);

-- Rotating refresh tokens; reuse of a used/replaced row revokes the family
-- (spec §3.2 / §6).
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash  TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL,
  jti         TEXT NOT NULL REFERENCES agent_tokens (jti) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  replaced_by TEXT REFERENCES refresh_tokens (token_hash) ON DELETE SET NULL,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_id_idx ON refresh_tokens (family_id);

-- Live + historical agent sessions / presence (spec §6).
CREATE TABLE IF NOT EXISTS agent_sessions (
  session_id TEXT PRIMARY KEY,
  user_id    UUID NOT NULL,
  jti        TEXT NOT NULL,
  repo       TEXT,
  status     TEXT NOT NULL DEFAULT 'started',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at   TIMESTAMPTZ,
  last_seq   BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS agent_sessions_user_id_idx ON agent_sessions (user_id);
