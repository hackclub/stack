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

export async function getPublicTables() {
  if (!pool) {
    throw new Error("DATABASE_URL is not set.");
  }

  const result = await pool.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name
  `);

  return result.rows.map((row) => row.table_name);
}

export async function getTableColumns(tableName) {
  if (!pool) {
    throw new Error("DATABASE_URL is not set.");
  }

  const result = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
      order by ordinal_position
    `,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

export async function getTablePrimaryKeyColumns(tableName) {
  if (!pool) {
    throw new Error("DATABASE_URL is not set.");
  }

  const result = await pool.query(
    `
      select key_column_usage.column_name
      from information_schema.table_constraints
      join information_schema.key_column_usage
        on table_constraints.constraint_name = key_column_usage.constraint_name
        and table_constraints.table_schema = key_column_usage.table_schema
        and table_constraints.table_name = key_column_usage.table_name
      where table_constraints.table_schema = 'public'
        and table_constraints.table_name = $1
        and table_constraints.constraint_type = 'PRIMARY KEY'
      order by key_column_usage.ordinal_position
    `,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

export async function getTableRows(tableName) {
  if (!pool) {
    throw new Error("DATABASE_URL is not set.");
  }

  const result = await pool.query(`select * from ${quoteIdentifier(tableName)}`);
  return result.rows;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
