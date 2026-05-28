import { pool } from "./db.js";
import { deleteProjectFromAirtable, persistProjectAirtableRecordId, syncProjectToAirtable } from "./airtableProjects.js";
import { syncJournalEntryToAirtable } from "./airtableJournals.js";
import { deleteProjectSubmissionsFromYsws, ensureYswsProjectSubmissionsTable, submitProjectToYsws } from "./airtableYsws.js";
import { fetchHackatimeProjects, sumHackatimeHoursForNames } from "./hackatimeAuth.js";

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
      reviewed BOOLEAN NOT NULL DEFAULT FALSE,
      total_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
      approved_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
      past_approved_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
      bricks_earned NUMERIC(10, 2) NOT NULL DEFAULT 0,
      admin_feedback TEXT,
      hour_justification TEXT,
      reviewed_at TIMESTAMPTZ,
      reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      shipped_at TIMESTAMPTZ,
      fraud_flag BOOLEAN NOT NULL DEFAULT FALSE,
      baseline_hours NUMERIC(10, 2),
      last_shipped_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
      hackatime_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
      airtable_record_id TEXT,
      ysws_record_id TEXT,
      parent_project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
      ship_kind TEXT NOT NULL DEFAULT 'initial',
      blocked BOOLEAN NOT NULL DEFAULT FALSE,
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
    reviewed: "BOOLEAN NOT NULL DEFAULT FALSE",
    total_hours: "NUMERIC(10, 2) NOT NULL DEFAULT 0",
    approved_hours: "NUMERIC(10, 2) NOT NULL DEFAULT 0",
    past_approved_hours: "NUMERIC(10, 2) NOT NULL DEFAULT 0",
    bricks_earned: "NUMERIC(10, 2) NOT NULL DEFAULT 0",
    admin_feedback: "TEXT",
    hour_justification: "TEXT",
    reviewed_at: "TIMESTAMPTZ",
    reviewed_by_user_id: "INTEGER REFERENCES users(id) ON DELETE SET NULL",
    shipped_at: "TIMESTAMPTZ",
    fraud_flag: "BOOLEAN NOT NULL DEFAULT FALSE",
    baseline_hours: "NUMERIC(10, 2)",
    last_shipped_hours: "NUMERIC(10, 2) NOT NULL DEFAULT 0",
    hackatime_hours: "NUMERIC(10, 2) NOT NULL DEFAULT 0",
    airtable_record_id: "TEXT",
    ysws_record_id: "TEXT",
    parent_project_id: "BIGINT REFERENCES projects(id) ON DELETE SET NULL",
    ship_kind: "TEXT NOT NULL DEFAULT 'initial'",
    blocked: "BOOLEAN NOT NULL DEFAULT FALSE",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  };

  for (const [column, definition] of Object.entries(columns)) {
    await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
  }

  await pool.query("ALTER TABLE projects DROP COLUMN IF EXISTS github_username");
  await pool.query(`UPDATE projects SET reviewed = FALSE WHERE reviewed IS NULL`);
  await pool.query(`UPDATE projects SET past_approved_hours = COALESCE(approved_hours, 0) WHERE past_approved_hours IS NULL`);
  await pool.query(`
    UPDATE projects
    SET past_approved_hours = GREATEST(COALESCE(past_approved_hours, 0), COALESCE(approved_hours, 0))
    WHERE COALESCE(past_approved_hours, 0) < COALESCE(approved_hours, 0)
  `);
  await pool.query(`UPDATE projects SET bricks_earned = 0 WHERE bricks_earned IS NULL`);
  await pool.query(`UPDATE projects SET fraud_flag = FALSE WHERE fraud_flag IS NULL`);
  await pool.query(`UPDATE projects SET ship_kind = 'initial' WHERE ship_kind IS NULL`);
  await pool.query(`UPDATE projects SET blocked = FALSE WHERE blocked IS NULL`);
  await pool.query(`
    UPDATE projects
    SET last_shipped_hours = GREATEST(
      COALESCE(last_shipped_hours, 0),
      COALESCE(baseline_hours, 0),
      COALESCE(past_approved_hours, 0),
      COALESCE(approved_hours, 0)
    )
    WHERE COALESCE(last_shipped_hours, 0) = 0
      AND (
        status IN ('approved', 'pending-reship', 'reship-rejected')
        OR COALESCE(past_approved_hours, 0) > 0
        OR COALESCE(approved_hours, 0) > 0
      )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_user_name_lower ON projects(user_id, LOWER(name))`);

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
  await ensureYswsProjectSubmissionsTable();
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
  await assertProjectNameAvailable(userId, project.name);

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
      JSON.stringify(project.hackatimeNames || []),
    ]
  );

  const row = result.rows[0];
  await applyHackatimeHoursToProject(userId, row.id);
  await trySyncProjectToAirtable(row.id);
  return toPublicProject((await getProjectRowForAirtableSync(row.id)) || row);
}

export async function updateProjectForUser(userId, projectId, input) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const project = normalizeProjectInput(input);
  validateProjectBasics(project);
  await assertProjectNameAvailable(userId, project.name, projectId);

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
        hackatime_names = $7,
        updated_at = NOW()
      WHERE id = $8
        AND user_id = $9
      RETURNING *
    `,
    [
      project.name,
      project.description,
      project.projectType,
      project.playableUrl,
      project.codeUrl,
      project.imageUrl,
      JSON.stringify(project.hackatimeNames || []),
      projectId,
      userId,
    ]
  );

  if (!result.rows[0]) return null;
  await applyHackatimeHoursToProject(userId, result.rows[0].id);
  await trySyncProjectToAirtable(result.rows[0].id);
  return toPublicProject((await getProjectRowForAirtableSync(result.rows[0].id)) || result.rows[0]);
}

export async function shipProjectForUser(userId, projectId) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  await refreshProjectJournalHours(userId, projectId);
  const project = await getProjectRowForUser(userId, projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  if (project.blocked) {
    throw new Error("This project has been blocked and cannot be shipped again.");
  }

  const missing = getShipMissingRequirements(project);
  if (missing.length > 0) {
    throw new Error(`Cannot ship yet: ${missing.join(", ")}.`);
  }

  const isReship =
    (project.status === "approved" && project.reviewed) ||
    project.status === "reship-rejected";
  if (isReship) {
    const newHours = pendingReviewHours(project);
    if (newHours <= 0) {
      throw new Error("No new hours to ship. Add more hours before re-shipping.");
    }
  }

  const result = await pool.query(
    `
      UPDATE projects
      SET
        shipped = TRUE,
        status = $3,
        ship_kind = $4,
        reviewed = FALSE,
        reviewed_at = NULL,
        reviewed_by_user_id = NULL,
        admin_feedback = NULL,
        shipped_at = NOW(),
        hour_justification = $5,
        updated_at = NOW()
      WHERE user_id = $1
        AND id = $2
      RETURNING *, total_hours AS journal_hours
    `,
    [
      userId,
      projectId,
      isReship ? "pending-reship" : "in-review",
      isReship ? "reship" : "initial",
      null,
    ]
  );

  const row = result.rows[0];
  await trySyncProjectToAirtable(row.id);
  await trySubmitProjectToYsws(row.id);
  return toPublicProject(row);
}

export function buildDefaultJustificationTemplate({
  approvedHours = null,
  totalHours = null,
  reductionHours = null,
  reviewerName = null,
  shippingDate = null,
} = {}) {
  const approved = approvedHours != null ? Number(approvedHours).toFixed(2) : "<tot_approved_hours>";
  const total = totalHours != null ? Number(totalHours).toFixed(2) : "<tot_logged_hours>";
  const reduction = reductionHours != null ? Number(reductionHours).toFixed(2) : "<red_hours>";
  const reviewer = reviewerName || "<reviewer_name>";
  const shipped = formatJustificationDate(shippingDate) || "<shipping_date>";

  return [
    "The project includes [leave empty, I'll manually enter this].",
    `The commit history shows [leave empty, I'll manually enter this] commits. ${approved} hours is consistent with this scope.`,
    `Hackatime project user analyzed from 05/28/26 to ${shipped} shows ${total} hours tracked. The heartbeat pattern is consistent with active development.`,
    "",
    `Total hours approved (cumulative on this project): ${approved} h.`,
    `Total logged at review (Hackatime + journal): ${total} h.`,
    `Reduction from logged: ${reduction}h less approved than logged.`,
    `Project reviewed by ${reviewer}. Demo and repository looked solid, including heartbeats.`,
  ].join("\n");
}

export async function listAdminReviewProjects({ shipSort = "oldest" } = {}) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const direction = shipSort === "newest" ? "DESC" : "ASC";
  const result = await pool.query(`
    SELECT
      projects.*,
      COALESCE(SUM(journal_entries.hours_worked), 0) AS journal_hours,
      users.email AS user_email,
      users.name AS user_name,
      users.slug AS user_slug,
      users.profile_image_url AS user_profile_image_url,
      users.slack_id AS user_slack_id
    FROM projects
    JOIN users ON users.id = projects.user_id
    LEFT JOIN journal_entries
      ON journal_entries.project_id = projects.id
      AND journal_entries.user_id = projects.user_id
    GROUP BY projects.id, users.id
    ORDER BY projects.shipped_at ${direction} NULLS LAST, projects.updated_at ${direction}, projects.id ${direction}
  `);

  const projects = result.rows.map(toAdminReviewProject);
  const pendingProjects = projects.filter(isPendingReviewProject);
  return {
    projects: projects.filter((project) => !isPendingReviewProject(project)),
    pendingProjects,
  };
}

export async function getAdminReviewProject(projectId) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const result = await pool.query(
    `
      SELECT
        projects.*,
        COALESCE(SUM(journal_entries.hours_worked), 0) AS journal_hours,
        users.email AS user_email,
        users.name AS user_name,
        users.slug AS user_slug,
        users.profile_image_url AS user_profile_image_url,
        users.slack_id AS user_slack_id
      FROM projects
      JOIN users ON users.id = projects.user_id
      LEFT JOIN journal_entries
        ON journal_entries.project_id = projects.id
        AND journal_entries.user_id = projects.user_id
      WHERE projects.id = $1
      GROUP BY projects.id, users.id
    `,
    [projectId]
  );

  const project = result.rows[0] ? toAdminReviewProject(result.rows[0]) : null;
  if (!project) return null;

  const journalEntries = await listJournalEntriesForUserProject(project.userId, project.id);
  return { project, journalEntries };
}

export async function approveAdminReviewProject(adminId, projectId, input = {}) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const requestedApprovedHours = Number.parseFloat(input.approvedHours ?? input.approved_hours ?? 0);
  const approvedHours = roundedHours(requestedApprovedHours);
  const feedback = textOrNull(input.feedback);
  if (!Number.isFinite(requestedApprovedHours) || approvedHours <= 0) {
    throw new Error("Enter a positive number of new hours to approve for this submission.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await refreshProjectJournalHoursWithClient(client, projectId);

    const projectResult = await client.query("SELECT * FROM projects WHERE id = $1 FOR UPDATE", [projectId]);
    const project = projectResult.rows[0];
    if (!project) throw new Error("Project not found.");
    if (!project.shipped) throw new Error("Project is not in the review queue.");
    if (project.reviewed && project.status === "approved") throw new Error("Project is already approved.");

    const bankedHours = approvedBankedHours(project);
    const totalLoggedHours = loggedHours(project);
    const pendingCap = pendingReviewHours(project);
    if (approvedHours > pendingCap) {
      throw new Error(`Cannot approve more new hours than the participant has logged beyond prior approvals (${pendingCap.toFixed(2)} h max).`);
    }

    const newTotalApprovedHours = roundedHours(bankedHours + approvedHours);
    if (newTotalApprovedHours > totalLoggedHours) {
      throw new Error(`Cannot approve ${newTotalApprovedHours.toFixed(2)} total hours because only ${totalLoggedHours.toFixed(2)} hours are logged.`);
    }

    const bricksDelta = approvedHours * 20;
    const reductionHours = Math.max(0, roundedHours(totalLoggedHours - newTotalApprovedHours));
    const newCumulativeBricks = Number(project.bricks_earned ?? 0) + bricksDelta;

    const reviewerResult = await client.query("SELECT name, email FROM users WHERE id = $1", [adminId]);
    const reviewerName = reviewerResult.rows[0]?.name || reviewerResult.rows[0]?.email || "<reviewer>";
    const finalJustification = buildDefaultJustificationTemplate({
      approvedHours: newTotalApprovedHours,
      totalHours: totalLoggedHours,
      reductionHours,
      reviewerName,
      shippingDate: project.shipped_at,
    });

    const updatedProjectResult = await client.query(
      `
        UPDATE projects
        SET
          reviewed = TRUE,
          reviewed_at = NOW(),
          reviewed_by_user_id = $1,
          status = 'approved',
          ship_kind = 'initial',
          approved_hours = $2,
          past_approved_hours = $2,
          baseline_hours = COALESCE(baseline_hours, $7),
          last_shipped_hours = $7,
          hour_justification = $3,
          admin_feedback = $4,
          bricks_earned = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING *, total_hours AS journal_hours
      `,
      [adminId, newTotalApprovedHours, finalJustification, feedback, newCumulativeBricks, projectId, totalLoggedHours]
    );
    const approvedRow = updatedProjectResult.rows[0];

    await client.query("UPDATE users SET bricks = bricks + $1, updated_at = NOW() WHERE id = $2", [bricksDelta, project.user_id]);
    await client.query("COMMIT");

    await trySyncProjectToAirtable(approvedRow.id);
    await trySubmitProjectToYsws(approvedRow.id);

    return {
      project: toPublicProject(approvedRow),
      bricksEarned: bricksDelta,
      approvedHours: newTotalApprovedHours,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectAdminReviewProject(adminId, projectId, input = {}) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const feedback = textOrNull(input.feedback);
  if (!feedback) {
    throw new Error("Rejection requires a written comment (what to fix before resubmitting).");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await refreshProjectJournalHoursWithClient(client, projectId);

    const lookup = await client.query("SELECT ship_kind FROM projects WHERE id = $1 FOR UPDATE", [projectId]);
    const isReship = lookup.rows[0]?.ship_kind === "reship";

    const result = await client.query(
      `
        UPDATE projects
        SET
          shipped = FALSE,
          shipped_at = NULL,
          reviewed = TRUE,
          reviewed_at = NOW(),
          reviewed_by_user_id = $1,
          status = $4,
          ship_kind = 'initial',
          admin_feedback = $2,
          last_shipped_hours = CASE
            WHEN $5 THEN GREATEST(
              COALESCE(last_shipped_hours, 0),
              COALESCE(total_hours, 0) + COALESCE(hackatime_hours, 0)
            )
            ELSE last_shipped_hours
          END,
          updated_at = NOW()
        WHERE id = $3
          AND shipped IS TRUE
        RETURNING *, total_hours AS journal_hours
      `,
      [adminId, feedback, projectId, isReship ? "reship-rejected" : "rejected", isReship]
    );

    if (!result.rows[0]) {
      throw new Error("Project is not in the review queue.");
    }

    await client.query("COMMIT");

    const row = result.rows[0];
    await trySyncProjectToAirtable(row.id);
    await trySubmitProjectToYsws(row.id);
    return toPublicProject(row);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function blockAdminReviewProject(adminId, projectId, input = {}) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const feedback = textOrNull(input.feedback);
  if (!feedback) {
    throw new Error("Blocking requires a written reason.");
  }

  const result = await pool.query(
    `
      UPDATE projects
      SET
        shipped = FALSE,
        shipped_at = NULL,
        reviewed = TRUE,
        reviewed_at = NOW(),
        reviewed_by_user_id = $1,
        status = 'blocked',
        blocked = TRUE,
        admin_feedback = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *, total_hours AS journal_hours
    `,
    [adminId, feedback, projectId]
  );

  if (!result.rows[0]) {
    throw new Error("Project not found.");
  }

  const row = result.rows[0];
  if (row.parent_project_id) {
    await pool.query(
      `UPDATE projects SET blocked = TRUE, updated_at = NOW() WHERE id = $1`,
      [row.parent_project_id]
    );
    await trySyncProjectToAirtable(row.parent_project_id);
  }

  await trySyncProjectToAirtable(row.id);
  await trySubmitProjectToYsws(row.id);
  return toPublicProject(row);
}

export async function patchAdminReviewProjectFlags(projectId, input = {}) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const hasFraud =
    input.fraudFlag !== undefined || input.fraud_flag !== undefined || input.fraud !== undefined;
  if (!hasFraud) {
    throw new Error("Nothing to update.");
  }

  const fraudFlag = Boolean(input.fraudFlag ?? input.fraud_flag ?? input.fraud);
  const result = await pool.query(
    `
      UPDATE projects
      SET fraud_flag = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `,
    [fraudFlag, projectId]
  );

  if (!result.rows[0]) {
    throw new Error("Project not found.");
  }

  return getAdminReviewProject(projectId);
}

export async function deleteProjectBySuperadmin(projectId) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const row = await getProjectRowForAirtableSync(projectId);
  if (!row) return false;

  await deleteProjectFromAirtable(row);
  await deleteProjectSubmissionsFromYsws(projectId);

  const result = await pool.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
  return result.rowCount > 0;
}

export async function deleteProjectForUser(userId, projectId) {
  if (!pool) throw new Error("DATABASE_URL is not set.");

  const checkResult = await pool.query("SELECT shipped FROM projects WHERE id = $1 AND user_id = $2", [projectId, userId]);
  const project = checkResult.rows[0];

  if (!project) return false;
  if (project.shipped) throw new Error("Cannot delete a project that has been shipped.");

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

  syncJournalEntryToAirtable(result.rows[0]).catch((err) => {
    console.error("[airtable] Failed to sync journal entry:", err.message);
  });

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
      COALESCE(users.name, users.slug) AS user_display_name
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

function normalizeHackatimeNames(input = {}) {
  const raw = input.hackatimeNames ?? input.hackatime_names ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.map((name) => String(name).trim()).filter(Boolean);
}

function safeHttpUrl(value) {
  const text = textOrNull(value);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`URL must use http or https (got ${parsed.protocol})`);
    }
    return text;
  } catch (e) {
    throw new Error(e.message || "Invalid URL.");
  }
}

function normalizeProjectInput(input = {}) {
  return {
    name: textOrNull(input.name),
    description: textOrNull(input.description),
    projectType: textOrNull(input.projectType ?? input.project_type),
    playableUrl: safeHttpUrl(input.playableUrl ?? input.playable_url),
    codeUrl: safeHttpUrl(input.codeUrl ?? input.code_url),
    imageUrl: safeHttpUrl(input.imageUrl ?? input.image_url),
    hackatimeNames: normalizeHackatimeNames(input),
  };
}

export async function refreshProjectHackatimeHoursForUser(userId, hackatimeProjects = null) {
  if (!pool) return;

  const tokenResult = await pool.query(
    `SELECT hackatime_access_token FROM users WHERE id = $1`,
    [userId]
  );
  const token = tokenResult.rows[0]?.hackatime_access_token;
  if (!token && !hackatimeProjects) return;

  const list = hackatimeProjects || (await fetchHackatimeProjects(token));
  const projectsResult = await pool.query(
    `SELECT id, hackatime_names FROM projects WHERE user_id = $1`,
    [userId]
  );

  for (const project of projectsResult.rows) {
    const names = Array.isArray(project.hackatime_names) ? project.hackatime_names : [];
    const hours = sumHackatimeHoursForNames(list, names);
    await pool.query(
      `UPDATE projects SET hackatime_hours = $1, updated_at = NOW() WHERE id = $2`,
      [hours, project.id]
    );
    await trySyncProjectToAirtable(project.id);
  }
}

async function applyHackatimeHoursToProject(userId, projectId) {
  const tokenResult = await pool.query(
    `SELECT hackatime_access_token FROM users WHERE id = $1`,
    [userId]
  );
  const token = tokenResult.rows[0]?.hackatime_access_token;
  if (!token) return;

  const projectResult = await pool.query(
    `SELECT hackatime_names FROM projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  const names = projectResult.rows[0]?.hackatime_names || [];
  const list = await fetchHackatimeProjects(token);
  const hours = sumHackatimeHoursForNames(list, names);

  await pool.query(
    `UPDATE projects SET hackatime_hours = $1, updated_at = NOW() WHERE id = $2`,
    [hours, projectId]
  );
}

export async function getProjectForUser(userId, projectId) {
  const row = await getProjectRowForAirtableSync(projectId);
  if (!row || Number(row.user_id) !== Number(userId)) return null;
  await applyHackatimeHoursToProject(userId, projectId);
  const refreshed = await getProjectRowForAirtableSync(projectId);
  return toPublicProject(refreshed || row);
}

function validateProjectBasics(project) {
  if (!project.name) throw new Error("Project name is required.");
  if (!project.description) throw new Error("Project description is required.");
  if (!project.projectType) throw new Error("Project type is required.");
}

async function assertProjectNameAvailable(userId, projectName, exceptProjectId = null) {
  const result = await pool.query(
    `
      SELECT id
      FROM projects
      WHERE user_id = $1
        AND LOWER(name) = LOWER($2)
        AND ($3::bigint IS NULL OR id != $3::bigint)
      LIMIT 1
    `,
    [userId, projectName, exceptProjectId]
  );

  if (result.rows.length > 0) {
    throw new Error("You already have a project with that name.");
  }
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

  const row = result.rows[0];
  if (row) await trySyncProjectToAirtable(row.id);
  return row ? toPublicProject(row) : null;
}

async function refreshProjectJournalHoursWithClient(client, projectId) {
  await client.query(
    `
      UPDATE projects
      SET
        total_hours = COALESCE((
          SELECT SUM(hours_worked)
          FROM journal_entries
          WHERE journal_entries.user_id = projects.user_id
            AND journal_entries.project_id = projects.id
        ), 0),
        updated_at = NOW()
      WHERE id = $1
    `,
    [projectId]
  );
}

function textOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundedHours(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
}

function loggedHours(row) {
  return roundedHours(numberOrZero(row.journal_hours ?? row.total_hours) + numberOrZero(row.hackatime_hours));
}

function approvedBankedHours(row) {
  return roundedHours(Math.max(numberOrZero(row.past_approved_hours), numberOrZero(row.approved_hours)));
}

function previouslyShippedHours(row) {
  return roundedHours(Math.max(numberOrZero(row.last_shipped_hours), approvedBankedHours(row)));
}

function pendingReviewHours(row) {
  return Math.max(0, roundedHours(loggedHours(row) - previouslyShippedHours(row)));
}

async function getProjectRowForAirtableSync(projectId) {
  if (!pool) return null;

  const result = await pool.query(
    `
      SELECT
        projects.*,
        COALESCE(SUM(journal_entries.hours_worked), 0) AS journal_hours,
        users.email AS user_email,
        users.slack_id AS user_slack_id
      FROM projects
      JOIN users ON users.id = projects.user_id
      LEFT JOIN journal_entries
        ON journal_entries.project_id = projects.id
        AND journal_entries.user_id = projects.user_id
      WHERE projects.id = $1
      GROUP BY projects.id, users.id
    `,
    [projectId]
  );

  return result.rows[0] ?? null;
}

async function trySubmitProjectToYsws(projectId, options = {}) {
  try {
    const result = await submitProjectToYsws(projectId, options);
    if (!result.skipped) {
      console.log("[projects] Airtable YSWS submit:", {
        projectId,
        recordId: result.recordId,
        status: result.status,
        created: result.created,
      });
    }
  } catch (error) {
    console.error("[projects] Airtable YSWS submit failed:", {
      projectId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function trySyncProjectToAirtable(projectId) {
  try {
    const row = await getProjectRowForAirtableSync(projectId);
    if (!row) return;

    const result = await syncProjectToAirtable(row);
    if (result.ok && result.recordId) {
      await persistProjectAirtableRecordId(projectId, result.recordId);
    }
    if (!result.skipped) {
      console.log("[projects] Airtable _projects sync:", {
        projectId,
        created: result.created,
        recordId: result.recordId,
      });
    }
  } catch (error) {
    console.error("[projects] Airtable _projects sync failed:", {
      projectId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function toPublicProject(row) {
  const journalHours = Number(row.journal_hours ?? row.total_hours ?? 0);
  const hackatimeHours = Number(row.hackatime_hours ?? 0);
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
    reviewed: row.reviewed,
    totalHours: Number(row.total_hours ?? 0),
    journalHours,
    hackatimeHours,
    combinedHours: Number((journalHours + hackatimeHours).toFixed(2)),
    baselineHours: row.baseline_hours != null ? Number(row.baseline_hours) : null,
    lastShippedHours: previouslyShippedHours(row),
    approvedHours: Number(row.approved_hours ?? 0),
    pastApprovedHours: approvedBankedHours(row),
    bricksEarned: Number(row.bricks_earned ?? 0),
    adminFeedback: row.admin_feedback,
    hourJustification: row.hour_justification,
    reviewedAt: row.reviewed_at,
    reviewedByUserId: row.reviewed_by_user_id,
    shippedAt: row.shipped_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fraudFlag: Boolean(row.fraud_flag),
    blocked: Boolean(row.blocked),
    shipKind: row.ship_kind || "initial",
    parentProjectId: row.parent_project_id != null ? Number(row.parent_project_id) : null,
  };
}

function toAdminReviewProject(row) {
  const project = toPublicProject(row);
  return {
    ...project,
    user: {
      id: row.user_id,
      email: row.user_email,
      name: row.user_name,
      slug: row.user_slug,
      profileImageUrl: row.user_profile_image_url,
      slackId: row.user_slack_id,
    },
    pendingReviewHours: pendingReviewHours(row),
  };
}

function isPendingReviewProject(project) {
  if (project.reviewed) return false;

  const status = String(project.status || "").toLowerCase();
  if (status === "in-review" && project.shipped) return true;
  if (status === "pending-reship") return true;

  return project.shipped && project.shipKind === "reship";
}

function getShipMissingRequirements(project) {
  const missing = [];
  // Block shipping only if already shipped but not in a valid state for re-shipping
  if (
    project.shipped &&
    project.status !== "approved" &&
    project.status !== "rejected" &&
    project.status !== "reship-rejected"
  ) {
    missing.push("already shipped");
  }
  if (!textOrNull(project.playable_url)) missing.push("playable URL missing");
  if (!textOrNull(project.code_url)) missing.push("code URL missing");
  if (!textOrNull(project.image_url)) missing.push("project image missing");
  const combinedHours =
    Number(project.total_hours ?? 0) + Number(project.hackatime_hours ?? 0);
  if (combinedHours <= 0) missing.push("hours logged missing");
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
  let text = String(value);
  // Neutralize spreadsheet formula injection (=, +, -, @, tab, carriage-return as first char)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function toIsoString(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatJustificationDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}
