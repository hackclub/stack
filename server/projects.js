import { pool } from "./db.js";

export async function ensureProjectsTable() {
  if (!pool) {
    console.warn("[projects] DATABASE_URL not set; skipping projects table setup.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      project_type TEXT,
      playable_url TEXT,
      code_url TEXT,
      image_url TEXT,
      hackatime_names JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft',
      shipped BOOLEAN NOT NULL DEFAULT FALSE,
      total_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
      approved_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
      shipped_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const columns = {
    user_id: "INTEGER REFERENCES users(id) ON DELETE CASCADE",
    name: "TEXT",
    description: "TEXT",
    project_type: "TEXT",
    playable_url: "TEXT",
    code_url: "TEXT",
    image_url: "TEXT",
    hackatime_names: "JSONB NOT NULL DEFAULT '[]'::jsonb",
    status: "TEXT NOT NULL DEFAULT 'draft'",
    shipped: "BOOLEAN NOT NULL DEFAULT FALSE",
    total_hours: "NUMERIC(10, 2) NOT NULL DEFAULT 0",
    approved_hours: "NUMERIC(10, 2) NOT NULL DEFAULT 0",
    shipped_at: "TIMESTAMPTZ",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  };

  for (const [column, definition] of Object.entries(columns)) {
    await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
  }

  await pool.query("ALTER TABLE projects DROP COLUMN IF EXISTS github_username");

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
      project_name TEXT NOT NULL,
      project_index INTEGER NOT NULL DEFAULT 0,
      time_done TIMESTAMPTZ,
      hours_worked NUMERIC(10, 2) NOT NULL DEFAULT 0,
      description TEXT,
      tools_used JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const journalColumns = {
    user_id: "INTEGER REFERENCES users(id) ON DELETE CASCADE",
    project_id: "BIGINT REFERENCES projects(id) ON DELETE CASCADE",
    project_name: "TEXT",
    project_index: "INTEGER NOT NULL DEFAULT 0",
    time_done: "TIMESTAMPTZ",
    hours_worked: "NUMERIC(10, 2) NOT NULL DEFAULT 0",
    description: "TEXT",
    tools_used: "JSONB NOT NULL DEFAULT '[]'::jsonb",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  };

  for (const [column, definition] of Object.entries(journalColumns)) {
    await pool.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
  }

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_journal_entries_user_project ON journal_entries(user_id, project_id)`);
}

export async function listProjectsForUser(userId) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const result = await pool.query(
    `
      SELECT projects.*, COALESCE(SUM(journal_entries.hours_worked), 0) AS journal_hours
      FROM projects
      LEFT JOIN journal_entries
        ON journal_entries.project_id = projects.id
        AND journal_entries.user_id = projects.user_id
      WHERE projects.user_id = $1
      GROUP BY projects.id
      ORDER BY projects.created_at DESC, projects.id DESC
    `,
    [userId]
  );

  return result.rows.map(toPublicProject);
}

export async function createProjectForUser(userId, input) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const project = normalizeProjectInput(input);
  validateProjectBasics(project);

  const result = await pool.query(
    `
      INSERT INTO projects (
        user_id,
        name,
        description,
        project_type,
        playable_url,
        code_url,
        image_url,
        hackatime_names,
        status,
        shipped
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', FALSE)
      RETURNING *
    `,
    [
      userId,
      project.name,
      project.description,
      project.projectType,
      project.playableUrl,
      project.codeUrl,
      project.imageUrl,
      JSON.stringify([]),
    ]
  );

  return toPublicProject(result.rows[0]);
}

export async function updateProjectForUser(userId, projectId, input) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const project = normalizeProjectInput(input);
  validateProjectBasics(project);

  const result = await pool.query(
    `
      UPDATE projects
      SET
        name = $1,
        description = $2,
        project_type = $3,
        playable_url = $4,
        code_url = $5,
        image_url = $6,
        updated_at = NOW()
      WHERE id = $7
        AND user_id = $8
      RETURNING *
    `,
    [
      project.name,
      project.description,
      project.projectType,
      project.playableUrl,
      project.codeUrl,
      project.imageUrl,
      projectId,
      userId,
    ]
  );

  return result.rows[0] ? toPublicProject(result.rows[0]) : null;
}

export async function shipProjectForUser(userId, projectId) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  await refreshProjectJournalHours(userId, projectId);
  const project = await getProjectRowForUser(userId, projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const missing = getShipMissingRequirements(project);
  if (missing.length > 0) {
    throw new Error(`Cannot ship yet: ${missing.join(", ")}.`);
  }

  const result = await pool.query(
    `
      UPDATE projects
      SET
        shipped = TRUE,
        status = 'in-review',
        shipped_at = NOW(),
        updated_at = NOW()
      WHERE user_id = $1
        AND id = $2
      RETURNING *, total_hours AS journal_hours
    `,
    [userId, projectId]
  );

  return toPublicProject(result.rows[0]);
}

export async function deleteProjectForUser(userId, projectId) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const result = await pool.query("DELETE FROM projects WHERE id = $1 AND user_id = $2", [projectId, userId]);
  return result.rowCount > 0;
}

export async function listJournalEntriesForUserProject(userId, projectId) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const result = await pool.query(
    `
      SELECT journal_entries.*
      FROM journal_entries
      JOIN projects
        ON projects.id = journal_entries.project_id
        AND projects.user_id = journal_entries.user_id
      WHERE journal_entries.user_id = $1
        AND journal_entries.project_id = $2
      ORDER BY journal_entries.created_at DESC, journal_entries.id DESC
    `,
    [userId, projectId]
  );

  return result.rows.map(toPublicJournalEntry);
}

export async function createJournalEntryForUser(userId, input = {}) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const projectId = input.projectId ?? input.project_id;
  const project = await getProjectRowForUser(userId, projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const journal = normalizeJournalEntryInput(input);
  const result = await pool.query(
    `
      INSERT INTO journal_entries (
        user_id,
        project_id,
        project_name,
        project_index,
        time_done,
        hours_worked,
        description,
        tools_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      userId,
      project.id,
      project.name,
      project.project_index ?? 0,
      journal.timeDone,
      journal.hoursWorked,
      journal.description,
      JSON.stringify(journal.toolsUsed),
    ]
  );

  const updatedProject = await refreshProjectJournalHours(userId, project.id);
  return {
    entry: toPublicJournalEntry(result.rows[0]),
    project: updatedProject,
  };
}

export async function getJournalEntriesCsv() {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const result = await pool.query(`
    SELECT
      journal_entries.*,
      projects.name AS current_project_name,
      users.email AS user_email,
      users.username AS user_display_name
    FROM journal_entries
    LEFT JOIN projects ON projects.id = journal_entries.project_id
    LEFT JOIN users ON users.id = journal_entries.user_id
    ORDER BY
      journal_entries.project_id NULLS LAST,
      journal_entries.project_name ASC,
      journal_entries.project_index ASC,
      journal_entries.created_at ASC
  `);

  return toCsv(
    [
      "project_id",
      "project_name_on_record",
      "project_name_stored_on_entry",
      "project_index",
      "user_id",
      "user_email",
      "user_display_name",
      "journal_entry_id",
      "time_done",
      "hours_worked",
      "description",
      "tools_used",
      "created_at",
      "updated_at",
    ],
    result.rows.map((row) => [
      row.project_id,
      row.current_project_name,
      row.project_name,
      row.project_index,
      row.user_id,
      row.user_email,
      row.user_display_name,
      row.id,
      toIsoString(row.time_done),
      row.hours_worked,
      row.description,
      Array.isArray(row.tools_used) ? row.tools_used.join("; ") : row.tools_used,
      toIsoString(row.created_at),
      toIsoString(row.updated_at),
    ])
  );
}

function normalizeProjectInput(input = {}) {
  return {
    name: textOrNull(input.name),
    description: textOrNull(input.description),
    projectType: textOrNull(input.projectType ?? input.project_type),
    playableUrl: textOrNull(input.playableUrl ?? input.playable_url),
    codeUrl: textOrNull(input.codeUrl ?? input.code_url),
    imageUrl: textOrNull(input.imageUrl ?? input.image_url),
  };
}

function validateProjectBasics(project) {
  if (!project.name) throw new Error("Project name is required.");
  if (!project.description) throw new Error("Project description is required.");
  if (!project.projectType) throw new Error("Project type is required.");
}

function normalizeJournalEntryInput(input = {}) {
  const hoursWorked = Number.parseFloat(input.hoursWorked ?? input.hours_worked ?? 0);
  const toolsValue = input.toolsUsed ?? input.tools_used ?? [];
  const toolsUsed = Array.isArray(toolsValue)
    ? toolsValue.map((tool) => String(tool).trim()).filter(Boolean)
    : String(toolsValue)
        .split(",")
        .map((tool) => tool.trim())
        .filter(Boolean);

  return {
    timeDone: input.timeDone || input.time_done || new Date().toISOString(),
    hoursWorked: Number.isFinite(hoursWorked) && hoursWorked >= 0 ? hoursWorked : 0,
    description: textOrNull(input.description),
    toolsUsed,
  };
}

async function getProjectRowForUser(userId, projectId) {
  const result = await pool.query(
    `
      SELECT projects.*, project_order.project_index
      FROM projects
      JOIN (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) - 1 AS project_index
        FROM projects
        WHERE user_id = $1
      ) project_order ON project_order.id = projects.id
      WHERE projects.user_id = $1
        AND projects.id = $2
    `,
    [userId, projectId]
  );

  return result.rows[0] || null;
}

async function refreshProjectJournalHours(userId, projectId) {
  const result = await pool.query(
    `
      UPDATE projects
      SET
        total_hours = COALESCE((
          SELECT SUM(hours_worked)
          FROM journal_entries
          WHERE user_id = $1
            AND project_id = $2
        ), 0),
        updated_at = NOW()
      WHERE user_id = $1
        AND id = $2
      RETURNING *, total_hours AS journal_hours
    `,
    [userId, projectId]
  );

  return result.rows[0] ? toPublicProject(result.rows[0]) : null;
}

function textOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function toPublicProject(row) {
  const journalHours = Number(row.journal_hours ?? row.total_hours ?? 0);
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    projectType: row.project_type,
    playableUrl: row.playable_url,
    codeUrl: row.code_url,
    imageUrl: row.image_url,
    hackatimeNames: row.hackatime_names || [],
    status: row.status,
    shipped: row.shipped,
    totalHours: Number(row.total_hours ?? 0),
    journalHours,
    approvedHours: Number(row.approved_hours ?? 0),
    shippedAt: row.shipped_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getShipMissingRequirements(project) {
  const missing = [];
  if (project.shipped) missing.push("already shipped");
  if (!textOrNull(project.playable_url)) missing.push("playable URL missing");
  if (!textOrNull(project.code_url)) missing.push("code URL missing");
  if (!textOrNull(project.image_url)) missing.push("project image missing");
  if (Number(project.total_hours ?? 0) <= 0) missing.push("hours logged missing");
  return missing;
}

function toPublicJournalEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    projectName: row.project_name,
    projectIndex: row.project_index,
    timeDone: row.time_done,
    hoursWorked: Number(row.hours_worked ?? 0),
    description: row.description,
    toolsUsed: row.tools_used || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `${lines.join("\n")}\n`;
}

function csvCell(value) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function toIsoString(value) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
