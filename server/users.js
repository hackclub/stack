import { pool } from "./db.js";

const DEFAULT_ROLE = "member";

function parseEmailList(value) {
  return (value || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Creates the users table if missing. Safe to run on every server start.
 */
export async function ensureUsersTable() {
  if (!pool) {
    console.warn("[users] DATABASE_URL not set; skipping users table setup.");
    return;
  }

  if (process.env.RECREATE_USERS_TABLE === "true") {
    console.warn("[users] RECREATE_USERS_TABLE=true, dropping users table before rebuild.");
    await pool.query(`DROP TABLE IF EXISTS users`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      hackclub_sub TEXT NOT NULL UNIQUE,
      email TEXT,
      name TEXT,
      slug TEXT,
      profile_image_url TEXT,
      slack_id TEXT,
      verification_status TEXT,
      role TEXT NOT NULL DEFAULT '${DEFAULT_ROLE}',
      access_token TEXT,
      refresh_token TEXT,
      token_type TEXT,
      token_expires_at TIMESTAMPTZ,
      expires_in_seconds INTEGER,
      scope TEXT,
      raw_profile JSONB,
      raw_token JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Backfill schema for older deployments where `users` already existed.
  // These are idempotent and safe to run on every boot.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS hackclub_sub TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS slug TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_id TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_type TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS expires_in_seconds INTEGER`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS scope TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS raw_profile JSONB`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS raw_token JSONB`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

  await pool.query(`
    UPDATE users
    SET role = '${DEFAULT_ROLE}'
    WHERE role IS NULL
  `);

  await pool.query(`
    ALTER TABLE users
    ALTER COLUMN role SET DEFAULT '${DEFAULT_ROLE}'
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)
  `);

  // Older deployments may have been created before hackclub_sub uniqueness was enforced.
  // Remove duplicates (keep oldest row) so upsert with ON CONFLICT works reliably.
  const dedupeResult = await pool.query(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY hackclub_sub ORDER BY id ASC) AS row_num
      FROM users
      WHERE hackclub_sub IS NOT NULL
    ),
    deleted AS (
      DELETE FROM users u
      USING ranked r
      WHERE u.id = r.id
        AND r.row_num > 1
      RETURNING u.id
    )
    SELECT COUNT(*)::int AS deleted_count FROM deleted
  `);

  const deletedCount = dedupeResult.rows?.[0]?.deleted_count ?? 0;
  if (deletedCount > 0) {
    console.warn(`[users] Removed ${deletedCount} duplicate user rows by hackclub_sub.`);
  }

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_hackclub_sub_unique ON users (hackclub_sub)
  `);
}

function resolveRole(email) {
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const admins = parseEmailList(process.env.ADMIN_EMAILS);
  if (normalizedEmail && admins.includes(normalizedEmail)) {
    return "admin";
  }
  return DEFAULT_ROLE;
}

function hackclubSubFromProfile(profile) {
  const subCandidate =
    profile?.sub ??
    profile?.id ??
    profile?.user_id ??
    profile?.uid ??
    profile?.hc_id ??
    profile?.slack_id ??
    null;

  if (subCandidate !== undefined && subCandidate !== null && String(subCandidate).trim()) {
    return String(subCandidate);
  }

  const emailCandidate = profile?.email ?? profile?.email_address ?? null;
  if (typeof emailCandidate === "string" && emailCandidate.trim()) {
    return `email:${emailCandidate.trim().toLowerCase()}`;
  }

  throw new Error("Hack Club profile missing stable identifier.");
}

/**
 * Persists token response + profile for a Hack Club user (insert or update).
 */
export async function upsertUserFromHackClub({ profile, token }) {
  if (!pool) {
    throw new Error("DATABASE_URL is not set.");
  }

  const hackclubSub = hackclubSubFromProfile(profile);
  const email = profile.email ?? profile.email_address ?? null;
  const name = profile.name ?? profile.full_name ?? profile.username ?? null;
  const slug = profile.slug ?? profile.username ?? null;
  const profileImageUrl = profile.profile_image_url ?? profile.picture ?? profile.avatar_url ?? null;
  const slackId = profile.slack_id ?? profile.slack_user_id ?? null;
  const verificationStatus = profile.verification_status ?? profile.verification ?? null;

  const accessToken = token.access_token ?? null;
  const refreshToken = token.refresh_token ?? null;
  const tokenType = token.token_type ?? null;
  const expiresIn = typeof token.expires_in === "number" ? token.expires_in : null;
  const scope = token.scope ?? null;

  let tokenExpiresAt = null;
  if (expiresIn) {
    tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  const role = resolveRole(email);

  const result = await pool.query(
    `
    INSERT INTO users (
      hackclub_sub,
      email,
      name,
      slug,
      profile_image_url,
      slack_id,
      verification_status,
      role,
      access_token,
      refresh_token,
      token_type,
      token_expires_at,
      expires_in_seconds,
      scope,
      raw_profile,
      raw_token
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
    )
    ON CONFLICT (hackclub_sub) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, users.email),
      name = COALESCE(EXCLUDED.name, users.name),
      slug = COALESCE(EXCLUDED.slug, users.slug),
      profile_image_url = COALESCE(EXCLUDED.profile_image_url, users.profile_image_url),
      slack_id = COALESCE(EXCLUDED.slack_id, users.slack_id),
      verification_status = COALESCE(EXCLUDED.verification_status, users.verification_status),
      role = CASE
        WHEN users.role = 'admin' THEN users.role
        WHEN EXCLUDED.role = 'admin' THEN 'admin'
        ELSE users.role
      END,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_type = EXCLUDED.token_type,
      token_expires_at = EXCLUDED.token_expires_at,
      expires_in_seconds = EXCLUDED.expires_in_seconds,
      scope = EXCLUDED.scope,
      raw_profile = EXCLUDED.raw_profile,
      raw_token = EXCLUDED.raw_token,
      updated_at = NOW()
    RETURNING *
    `,
    [
      hackclubSub,
      email,
      name,
      slug,
      profileImageUrl,
      slackId,
      verificationStatus,
      role,
      accessToken,
      refreshToken,
      tokenType,
      tokenExpiresAt,
      expiresIn,
      scope,
      JSON.stringify(profile ?? {}),
      JSON.stringify(token ?? {}),
    ]
  );

  return result.rows[0];
}

export async function getUserById(id) {
  if (!pool) {
    throw new Error("DATABASE_URL is not set.");
  }

  const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    hackclubSub: row.hackclub_sub,
    email: row.email,
    name: row.name,
    slug: row.slug,
    profileImageUrl: row.profile_image_url,
    slackId: row.slack_id,
    verificationStatus: row.verification_status,
    role: row.role,
  };
}
