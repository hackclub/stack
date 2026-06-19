import { pool } from "./db.js";
import { syncPostgresUserToAirtable } from "./airtableUsers.js";
import {
  fetchHackatimeMe,
  fetchHackatimeProjectCatalog,
  fetchHackatimeProjectsForLinkedNames,
  fetchHackatimeTotalHours,
  isHackatimeOAuthConfigured,
  refreshHackatimeAccessToken,
} from "./hackatimeAuth.js";
import { getAllLinkedHackatimeNamesForUser, syncAllProjectHoursForUser } from "./projects.js";

export function isHackatimeConnected(row) {
  return Boolean(row?.hackatime_access_token);
}

export async function saveHackatimeTokensForUser(userId, token) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const accessToken = token.access_token ?? null;
  const refreshToken = token.refresh_token ?? null;
  const expiresIn = typeof token.expires_in === "number" ? token.expires_in : null;
  let tokenExpiresAt = null;
  if (expiresIn) {
    tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  const result = await pool.query(
    `
      UPDATE users
      SET
        hackatime_access_token = $1,
        hackatime_refresh_token = $2,
        hackatime_token_expires_at = $3,
        hackatime_connected_at = COALESCE(hackatime_connected_at, NOW()),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `,
    [accessToken, refreshToken, tokenExpiresAt, userId]
  );

  return result.rows[0] ?? null;
}

export async function getHackatimeAccessTokenForUser(userId) {
  if (!pool) return null;
  const result = await pool.query(
    `
      SELECT
        hackatime_access_token,
        hackatime_refresh_token,
        hackatime_token_expires_at
      FROM users
      WHERE id = $1
    `,
    [userId]
  );
  return result.rows[0] ?? null;
}

async function withHackatimeAccessToken(userId, run) {
  const row = await getHackatimeAccessTokenForUser(userId);
  const accessToken = row?.hackatime_access_token;
  if (!accessToken) return null;

  const expiresAt = row.hackatime_token_expires_at
    ? new Date(row.hackatime_token_expires_at).getTime()
    : null;
  const shouldRefresh =
    row.hackatime_refresh_token &&
    expiresAt != null &&
    Number.isFinite(expiresAt) &&
    expiresAt <= Date.now() + 60_000;

  let token = accessToken;
  if (shouldRefresh) {
    try {
      const refreshed = await refreshHackatimeAccessToken(row.hackatime_refresh_token);
      await saveHackatimeTokensForUser(userId, refreshed);
      token = refreshed.access_token ?? accessToken;
    } catch (error) {
      console.error("[hackatime] token refresh failed:", {
        userId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    return await run(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const unauthorized = /\b401\b|unauthorized/i.test(message);
    if (!unauthorized || !row.hackatime_refresh_token) throw error;

    const refreshed = await refreshHackatimeAccessToken(row.hackatime_refresh_token);
    await saveHackatimeTokensForUser(userId, refreshed);
    const nextToken = refreshed.access_token;
    if (!nextToken) throw error;
    return run(nextToken);
  }
}

export async function refreshUserHackatimeCache(userId, accessToken) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const runRefresh = async (token) => {
    const linkedNames = await getAllLinkedHackatimeNamesForUser(userId);
    const [catalog, hours, linkedProjects] = await Promise.all([
      fetchHackatimeProjectCatalog(token),
      fetchHackatimeTotalHours(token),
      linkedNames.length > 0
        ? fetchHackatimeProjectsForLinkedNames(token, linkedNames)
        : Promise.resolve([]),
    ]);

    await pool.query(
      `
        UPDATE users
        SET hackatime_total_hours = $1, updated_at = NOW()
        WHERE id = $2
      `,
      [hours.totalHours, userId]
    );

    await syncAllProjectHoursForUser(userId, linkedProjects);

    return { projects: catalog, totalHours: hours.totalHours };
  };

  if (accessToken) {
    const refreshed = await runRefresh(accessToken);
    const userRow = (await pool.query(`SELECT * FROM users WHERE id = $1`, [userId])).rows[0];
    if (userRow) {
      try {
        await syncPostgresUserToAirtable(userRow);
      } catch (error) {
        console.error("[hackatime] Airtable user sync after refresh failed:", {
          userId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return refreshed;
  }

  const refreshed = await withHackatimeAccessToken(userId, runRefresh);
  if (!refreshed) {
    return { projects: [], totalHours: 0 };
  }

  const userRow = (await pool.query(`SELECT * FROM users WHERE id = $1`, [userId])).rows[0];
  if (userRow) {
    try {
      await syncPostgresUserToAirtable(userRow);
    } catch (error) {
      console.error("[hackatime] Airtable user sync after refresh failed:", {
        userId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return refreshed;
}

export async function connectHackatimeForUser(userId, tokenResponse) {
  await saveHackatimeTokensForUser(userId, tokenResponse);

  try {
    const me = await fetchHackatimeMe(tokenResponse.access_token);
    const githubUsername = me?.data?.username ?? me?.username ?? null;
    if (githubUsername) {
      await pool.query(
        `UPDATE users SET hackatime_github_username = $1, updated_at = NOW() WHERE id = $2`,
        [githubUsername, userId]
      );
    }
  } catch (error) {
    console.error("[hackatime] failed to fetch /me for GitHub username:", {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return refreshUserHackatimeCache(userId, tokenResponse.access_token);
}

export async function getHackatimeStatusForUser(userId) {
  if (!isHackatimeOAuthConfigured()) {
    return { configured: false, connected: false, projects: [], totalHours: 0 };
  }

  const tokenRow = await getHackatimeAccessTokenForUser(userId);
  if (!tokenRow?.hackatime_access_token) {
    return { configured: true, connected: false, projects: [], totalHours: 0 };
  }

  try {
    const result = await withHackatimeAccessToken(userId, async (token) => {
      const [projects, userRow] = await Promise.all([
        fetchHackatimeProjectCatalog(token),
        pool.query(`SELECT hackatime_total_hours FROM users WHERE id = $1`, [userId]),
      ]);
      return {
        projects,
        totalHours: Number(userRow.rows[0]?.hackatime_total_hours ?? 0),
      };
    });

    if (!result) {
      return { configured: true, connected: false, projects: [], totalHours: 0 };
    }

    return {
      configured: true,
      connected: true,
      projects: result.projects,
      totalHours: result.totalHours,
    };
  } catch (error) {
    console.error("[hackatime] status fetch failed:", {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      configured: true,
      connected: true,
      projects: [],
      totalHours: 0,
      error: "Failed to load Hackatime data.",
    };
  }
}

export async function listHackatimeProjectsForUser(userId) {
  const projects = await withHackatimeAccessToken(userId, fetchHackatimeProjectCatalog);
  return projects ?? [];
}

