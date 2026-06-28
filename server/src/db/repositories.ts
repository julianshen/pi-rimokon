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

  async setDecision(
    db: Db,
    userCode: string,
    status: 'approved' | 'denied',
    userId: string | null,
  ): Promise<void> {
    await db.query(`UPDATE device_codes SET status = $2, user_id = $3 WHERE user_code = $1`, [
      userCode,
      status,
      userId,
    ])
  },

  async markConsumed(db: Db, hash: string): Promise<void> {
    await db.query(`UPDATE device_codes SET status = 'consumed' WHERE device_code_hash = $1`, [hash])
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

  async markRotated(db: Db, hash: string, replacedBy: string, at: Date): Promise<void> {
    await db.query(
      `UPDATE refresh_tokens SET used_at = $2, replaced_by = $3 WHERE token_hash = $1`,
      [hash, at.toISOString(), replacedBy],
    )
  },

  async revokeFamily(db: Db, familyId: string, at: Date): Promise<void> {
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, $2) WHERE family_id = $1`,
      [familyId, at.toISOString()],
    )
  },
}
