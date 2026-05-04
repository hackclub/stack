import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

const getSslConfig = () => {
  const sslMode = process.env.PGSSLMODE;

  if (sslMode === "require" || sslMode === "no-verify") {
    return { rejectUnauthorized: false };
  }

  return undefined;
};

export const hasDatabaseConfig = Boolean(connectionString);

export const pool = hasDatabaseConfig
  ? new Pool({
      connectionString,
      ssl: getSslConfig(),
    })
  : null;

export async function checkDatabaseConnection() {
  if (!pool) {
    return {
      ok: false,
      configured: false,
      message: "DATABASE_URL is not set.",
    };
  }

  const result = await pool.query("select now() as now");

  return {
    ok: true,
    configured: true,
    now: result.rows[0].now,
  };
}

export async function getTestRows() {
  if (!pool) {
    throw new Error("DATABASE_URL is not set.");
  }

  const result = await pool.query("select * from test");
  return result.rows;
}
