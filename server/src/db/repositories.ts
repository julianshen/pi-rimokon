import type { Db } from './types.ts'

/** Render a string array as a Postgres array literal (`{"a","b"}`) for $n::text[]. */
function pgTextArray(values: string[]): string {
  return `{${values.map((v) => `"${v.replace(/(["\\])/g, '\\$1')}"`).join(',')}}`
}

// Timestamps are passed/stored as ISO strings; epoch-seconds are converted at
// the service boundary so the data layer stays SQL-shaped.

export type DeviceCodeStatus = 'pending' | 'approved' | 'denied' | 'consumed'

export interface DeviceCodeRow {
  device_code_hash: string
  user_code: string
  client_id: string
  status: DeviceCodeStatus
  user_id: string | null
  created_at: string
  expires_at: string
  last_polled_at: string | null
  poll_interval: number
}

export const deviceCodes = {
  async insert(
    db: Db,
    row: {
      deviceCodeHash: string
      userCode: string
      clientId: string
      expiresAt: Date
      pollInterval: number
    },
  ): Promise<void> {
    await db.query(
      `INSERT INTO device_codes (device_code_hash, user_code, client_id, status, expires_at, poll_interval)
       VALUES ($1, $2, $3, 'pending', $4, $5)`,
      [row.deviceCodeHash, row.userCode, row.clientId, row.expiresAt.toISOString(), row.pollInterval],
    )
  },

  async findByUserCode(db: Db, userCode: string): Promise<DeviceCodeRow | undefined> {
    const { rows } = await db.query<DeviceCodeRow>(
      `SELECT * FROM device_codes WHERE user_code = $1`,
      [userCode],
    )
    return rows[0]
  },

  async findByHash(db: Db, hash: string): Promise<DeviceCodeRow | undefined> {
    const { rows } = await db.query<DeviceCodeRow>(
      `SELECT * FROM device_codes WHERE device_code_hash = $1`,
      [hash],
    )
    return rows[0]
  },

  /**
   * Atomically record a decision, but only while the code is still `pending`.
   * Returns true iff this call won the transition (guards concurrent approvals).
   */
  async decide(
    db: Db,
    userCode: string,
    status: 'approved' | 'denied',
    userId: string | null,
  ): Promise<boolean> {
    const { rows } = await db.query<{ user_code: string }>(
      `UPDATE device_codes SET status = $2, user_id = $3
       WHERE user_code = $1 AND status = 'pending' RETURNING user_code`,
      [userCode, status, userId],
    )
    return rows.length === 1
  },

  /**
   * Atomically consume an approved code (single-use). Returns the bound
   * `user_id` iff this call flipped it from `approved` → `consumed`, else
   * undefined — so concurrent polls cannot both mint tokens.
   */
  async claimApproved(db: Db, hash: string): Promise<{ userId: string } | undefined> {
    const { rows } = await db.query<{ user_id: string }>(
      `UPDATE device_codes SET status = 'consumed'
       WHERE device_code_hash = $1 AND status = 'approved' RETURNING user_id`,
      [hash],
    )
    return rows[0] ? { userId: rows[0].user_id } : undefined
  },

  async touchPolled(db: Db, hash: string, at: Date): Promise<void> {
    await db.query(`UPDATE device_codes SET last_polled_at = $2 WHERE device_code_hash = $1`, [
      hash,
      at.toISOString(),
    ])
  },
}

export interface AgentTokenRow {
  jti: string
  family_id: string
  user_id: string
  label: string | null
  scopes: string[]
  created_at: string
  last_seen_at: string | null
  revoked_at: string | null
}

export const agentTokens = {
  async insert(
    db: Db,
    row: { jti: string; familyId: string; userId: string; scopes: string[]; label?: string },
  ): Promise<void> {
    await db.query(
      `INSERT INTO agent_tokens (jti, family_id, user_id, label, scopes) VALUES ($1, $2, $3, $4, $5::text[])`,
      [row.jti, row.familyId, row.userId, row.label ?? null, pgTextArray(row.scopes)],
    )
  },

  async findByJti(db: Db, jti: string): Promise<AgentTokenRow | undefined> {
    const { rows } = await db.query<AgentTokenRow>(`SELECT * FROM agent_tokens WHERE jti = $1`, [jti])
    return rows[0]
  },

  /** True when the token's jti exists and neither it nor its family is revoked. */
  async isActive(db: Db, jti: string): Promise<boolean> {
    const { rows } = await db.query<{ active: boolean }>(
      `SELECT (revoked_at IS NULL) AS active FROM agent_tokens WHERE jti = $1`,
      [jti],
    )
    return rows[0]?.active ?? false
  },

  async revokeFamily(db: Db, familyId: string, at: Date): Promise<void> {
    await db.query(
      `UPDATE agent_tokens SET revoked_at = COALESCE(revoked_at, $2) WHERE family_id = $1`,
      [familyId, at.toISOString()],
    )
  },
}

export interface RefreshTokenRow {
  token_hash: string
  family_id: string
  jti: string
  user_id: string
  issued_at: string
  expires_at: string
  used_at: string | null
  replaced_by: string | null
  revoked_at: string | null
}

export const refreshTokens = {
  async insert(
    db: Db,
    row: {
      tokenHash: string
      familyId: string
      jti: string
      userId: string
      expiresAt: Date
    },
  ): Promise<void> {
    await db.query(
      `INSERT INTO refresh_tokens (token_hash, family_id, jti, user_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [row.tokenHash, row.familyId, row.jti, row.userId, row.expiresAt.toISOString()],
    )
  },

  async findByHash(db: Db, hash: string): Promise<RefreshTokenRow | undefined> {
    const { rows } = await db.query<RefreshTokenRow>(
      `SELECT * FROM refresh_tokens WHERE token_hash = $1`,
      [hash],
    )
    return rows[0]
  },

  /**
   * Atomically claim an unused refresh token (sets `used_at` only while it is
   * still NULL). Returns the family/user/expiry iff this call won the race, so
   * concurrent rotations of the same token cannot both succeed.
   */
  async claim(
    db: Db,
    hash: string,
    at: Date,
  ): Promise<Pick<RefreshTokenRow, 'family_id' | 'user_id' | 'expires_at'> | undefined> {
    const { rows } = await db.query<
      Pick<RefreshTokenRow, 'family_id' | 'user_id' | 'expires_at'>
    >(
      `UPDATE refresh_tokens SET used_at = $2
       WHERE token_hash = $1 AND used_at IS NULL
       RETURNING family_id, user_id, expires_at`,
      [hash, at.toISOString()],
    )
    return rows[0]
  },

  /** Record which token replaced this one (the rotation successor). */
  async setReplacedBy(db: Db, hash: string, replacedBy: string): Promise<void> {
    await db.query(`UPDATE refresh_tokens SET replaced_by = $2 WHERE token_hash = $1`, [
      hash,
      replacedBy,
    ])
  },

  async revokeFamily(db: Db, familyId: string, at: Date): Promise<void> {
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, $2) WHERE family_id = $1`,
      [familyId, at.toISOString()],
    )
  },
}

export interface AgentSessionRow {
  session_id: string
  user_id: string
  jti: string
  repo: string | null
  status: string
  started_at: string
  ended_at: string | null
  last_seq: number
}

export const agentSessions = {
  async start(
    db: Db,
    row: { sessionId: string; userId: string; jti: string; repo?: string },
  ): Promise<void> {
    await db.query(
      `INSERT INTO agent_sessions (session_id, user_id, jti, repo, status)
       VALUES ($1, $2, $3, $4, 'started')`,
      [row.sessionId, row.userId, row.jti, row.repo ?? null],
    )
  },

  /** Close a live session (idempotent — only flips a non-ended row). */
  async end(db: Db, sessionId: string, lastSeq: number, at: Date): Promise<void> {
    await db.query(
      `UPDATE agent_sessions SET status = 'ended', ended_at = $2, last_seq = $3
       WHERE session_id = $1 AND status <> 'ended'`,
      [sessionId, at.toISOString(), lastSeq],
    )
  },

  async findById(db: Db, sessionId: string): Promise<AgentSessionRow | undefined> {
    const { rows } = await db.query<AgentSessionRow>(
      `SELECT * FROM agent_sessions WHERE session_id = $1`,
      [sessionId],
    )
    return rows[0]
  },
}
