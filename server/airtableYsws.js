import { pool } from "./db.js";

export const F = {
  codeUrl: "fldtr7fFjiivNl9T3",
  playableUrl: "fldfQ3F8R85jbolqa",
  firstName: "fldMNotCOmz9VjyV2",
  lastName: "fldNy8Bphu016COq2",
  email: "fldT7K3i5fXr9QhAl",
  screenshot: "fld9gXXU2IldSupLf",
  description: "fldbmLOboSDNuIwJ0",
  githubUsername: "fldBjgLezs9oxry9F",
  addressLine1: "fldR0FpeqHVEbH152",
  addressLine2: "fldDsc5lG6lQHOUvE",
  city: "fldqSLEbpf1vYzHDR",
  stateProvince: "fldOYj6uuGMTtp1P8",
  country: "fldAXAqf1UzvtiP3X",
  zip: "fldMfxehlHGGNssQa",
  birthday: "fldpBKxkhLlzhJsSY",
  overrideHours: "fldJgHp4dZbet58u6",
  overrideHoursJustification: "fldVfLaSZWGc3rZq3",
  status: process.env.AIRTABLE_YSWS_STATUS_FIELD_ID || "Status",
};

const airtableToken =
  process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const airtableBaseId =
  process.env.AIRTABLE_YSWS_BASE_ID || process.env.AIRTABLE_APP || process.env.AIRTABLE_BASE_ID;
const yswsTableId = process.env.AIRTABLE_YSWS_PROJECT_SUBMISSION_TABLE_ID || "tbl3EAvXrfhIkvLNp";

export const hasAirtableYswsConfig = Boolean(airtableToken && airtableBaseId);

export const YSWS_STATUS = {
  approved: "Approved",
  pending: "Pending",
  pendingReship: "Pending-reship",
};

function getYswsTableUrl() {
  return `https://api.airtable.com/v0/${airtableBaseId}/${yswsTableId}`;
}

function getAirtableHeaders() {
  return {
    Authorization: `Bearer ${airtableToken}`,
    "Content-Type": "application/json",
  };
}

async function airtableRequest(path, options = {}) {
  const response = await fetch(`${getYswsTableUrl()}${path}`, {
    ...options,
    headers: {
      ...getAirtableHeaders(),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.error || text || response.statusText;
    throw new Error(`Airtable YSWS request failed (${response.status}): ${message}`);
  }

  return data;
}

function airtableDate(value) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundedHours(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
}

function extractIdentity(rawProfile) {
  if (!rawProfile || typeof rawProfile !== "object") return {};
  if (rawProfile.identity && typeof rawProfile.identity === "object") {
    return rawProfile.identity;
  }
  return rawProfile;
}

function extractAddress(identity) {
  const address = identity?.address || identity?.addresses?.[0] || {};
  if (typeof address === "string") {
    return { line1: address };
  }
  return {
    line1: address.line_1 ?? address.line1 ?? address.street ?? address.street_address ?? null,
    line2: address.line_2 ?? address.line2 ?? address.street2 ?? null,
    city: address.city ?? address.locality ?? null,
    stateProvince: address.state ?? address.region ?? address.province ?? null,
    country: address.country ?? address.country_name ?? null,
    zip: address.zip ?? address.postal_code ?? address.postcode ?? null,
  };
}

function githubFromUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!/github\.com$/i.test(parsed.hostname)) return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[0] || null;
  } catch {
    return null;
  }
}

function totalLoggedHours(project) {
  return roundedHours(numberOrZero(project.total_hours) + numberOrZero(project.hackatime_hours));
}

function approvedBankedHours(project) {
  return roundedHours(Math.max(numberOrZero(project.past_approved_hours), numberOrZero(project.approved_hours)));
}

function previouslyShippedHours(project) {
  return roundedHours(Math.max(numberOrZero(project.last_shipped_hours), approvedBankedHours(project)));
}

function pendingHours(project) {
  return Math.max(0, roundedHours(totalLoggedHours(project) - previouslyShippedHours(project)));
}

function yswsStatusForProject(project) {
  const status = String(project.status || "").toLowerCase();

  if (status === "approved" && project.reviewed) return YSWS_STATUS.approved;
  if (status === "pending-reship" || project.ship_kind === "reship") return YSWS_STATUS.pendingReship;
  if (status === "in-review" && project.shipped && !project.reviewed) return YSWS_STATUS.pending;
  return null;
}

function yswsHoursForProject(project, status) {
  if (status === YSWS_STATUS.approved) return roundedHours(project.approved_hours);
  return pendingHours(project);
}

function buildSubmissionFromContext({ project, user, status }) {
  const identity = extractIdentity(user.raw_profile);
  const address = extractAddress(identity);
  const firstName = identity.first_name ?? identity.firstName ?? null;
  const lastName = identity.last_name ?? identity.lastName ?? null;
  const birthday = identity.birthdate ?? identity.birthday ?? identity.dob ?? null;
  const githubUsername = user.githubUsername || githubFromUrl(project.code_url);
  const hours = yswsHoursForProject(project, status);

  return {
    project_id: project.id,
    user_id: project.user_id,
    project_name: project.name,
    code_url: project.code_url || null,
    playable_url: project.playable_url || null,
    first_name: firstName || null,
    last_name: lastName || null,
    email: user.email || null,
    screenshot_url: project.image_url || null,
    description: project.description || null,
    github_username: githubUsername || null,
    address_line1: address.line1 || null,
    address_line2: address.line2 || null,
    city: address.city || null,
    state_province: address.stateProvince || null,
    country: address.country || null,
    zip: address.zip || null,
    birthday: airtableDate(birthday) || null,
    override_hours: hours,
    override_hours_justification: project.hour_justification || null,
    status,
    source_project_status: project.status || null,
    ship_kind: project.ship_kind || "initial",
    airtable_record_id: status === YSWS_STATUS.approved ? project.ysws_record_id || null : null,
  };
}

function buildFieldsFromSubmission(submission) {
  const fields = {
    [F.codeUrl]: submission.code_url || undefined,
    [F.playableUrl]: submission.playable_url || undefined,
    [F.firstName]: submission.first_name || undefined,
    [F.lastName]: submission.last_name || undefined,
    [F.email]: submission.email || undefined,
    [F.description]: submission.description || undefined,
    [F.githubUsername]: submission.github_username || undefined,
    [F.addressLine1]: submission.address_line1 || undefined,
    [F.addressLine2]: submission.address_line2 || undefined,
    [F.city]: submission.city || undefined,
    [F.stateProvince]: submission.state_province || undefined,
    [F.country]: submission.country || undefined,
    [F.zip]: submission.zip || undefined,
    [F.birthday]: airtableDate(submission.birthday),
    [F.overrideHours]: roundedHours(submission.override_hours),
    [F.overrideHoursJustification]: submission.override_hours_justification || undefined,
    [F.status]: submission.status,
  };

  if (submission.screenshot_url) {
    fields[F.screenshot] = [{ url: submission.screenshot_url }];
  }

  for (const key of Object.keys(fields)) {
    if (fields[key] === undefined) delete fields[key];
  }

  return fields;
}

export async function ensureYswsProjectSubmissionsTable() {
  if (!pool) {
    console.warn("[ysws] DATABASE_URL not set; skipping YSWS submissions table setup.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ysws_project_submissions (
      id BIGSERIAL PRIMARY KEY,
      project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      project_name TEXT,
      code_url TEXT,
      playable_url TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      screenshot_url TEXT,
      description TEXT,
      github_username TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      state_province TEXT,
      country TEXT,
      zip TEXT,
      birthday DATE,
      override_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
      override_hours_justification TEXT,
      status TEXT NOT NULL,
      source_project_status TEXT,
      ship_kind TEXT,
      airtable_record_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const columns = {
    project_id: "BIGINT REFERENCES projects(id) ON DELETE CASCADE",
    user_id: "INTEGER REFERENCES users(id) ON DELETE SET NULL",
    project_name: "TEXT",
    code_url: "TEXT",
    playable_url: "TEXT",
    first_name: "TEXT",
    last_name: "TEXT",
    email: "TEXT",
    screenshot_url: "TEXT",
    description: "TEXT",
    github_username: "TEXT",
    address_line1: "TEXT",
    address_line2: "TEXT",
    city: "TEXT",
    state_province: "TEXT",
    country: "TEXT",
    zip: "TEXT",
    birthday: "DATE",
    override_hours: "NUMERIC(10, 2) NOT NULL DEFAULT 0",
    override_hours_justification: "TEXT",
    status: "TEXT NOT NULL",
    source_project_status: "TEXT",
    ship_kind: "TEXT",
    airtable_record_id: "TEXT",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT NOW()",
  };

  for (const [column, definition] of Object.entries(columns)) {
    await pool.query(`ALTER TABLE ysws_project_submissions ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
  }

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ysws_project_submissions_project_status
    ON ysws_project_submissions(project_id, status)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ysws_project_submissions_status
    ON ysws_project_submissions(status)
  `);
}

async function getProjectContext(projectId) {
  if (!pool) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT projects.*, users.email AS user_email, users.raw_profile AS user_raw_profile,
             users.hackatime_github_username AS user_github_username
      FROM projects
      JOIN users ON users.id = projects.user_id
      WHERE projects.id = $1
    `,
    [projectId]
  );
  const row = result.rows[0];
  return row || null;
}

async function deleteLocalSubmission(submission) {
  if (!submission) return;

  if (submission.airtable_record_id && hasAirtableYswsConfig) {
    try {
      await airtableRequest(`/${submission.airtable_record_id}`, { method: "DELETE" });
    } catch (error) {
      if (!/404|NOT_FOUND/i.test(String(error.message))) {
        throw error;
      }
    }
  }

  await pool.query("DELETE FROM ysws_project_submissions WHERE id = $1", [submission.id]);
}

async function deleteProjectSubmissions(projectId, statuses) {
  const result = await pool.query(
    `
      SELECT *
      FROM ysws_project_submissions
      WHERE project_id = $1
        AND status = ANY($2::text[])
    `,
    [projectId, statuses]
  );

  for (const submission of result.rows) {
    await deleteLocalSubmission(submission);
  }
}

async function upsertLocalSubmission(submission) {
  if (submission.status === YSWS_STATUS.approved) {
    const approvedResult = await pool.query(
      "SELECT * FROM ysws_project_submissions WHERE project_id = $1 AND status = $2",
      [submission.project_id, YSWS_STATUS.approved]
    );
    const existingApproved = approvedResult.rows[0];

    if (!existingApproved) {
      const pendingResult = await pool.query(
        "SELECT * FROM ysws_project_submissions WHERE project_id = $1 AND status = $2",
        [submission.project_id, YSWS_STATUS.pending]
      );
      const existingPending = pendingResult.rows[0];
      if (existingPending) {
        submission.airtable_record_id = existingPending.airtable_record_id || submission.airtable_record_id;
        return updateLocalSubmission(existingPending.id, submission);
      }
    }
  }

  const result = await pool.query(
    `
      INSERT INTO ysws_project_submissions (
        project_id,
        user_id,
        project_name,
        code_url,
        playable_url,
        first_name,
        last_name,
        email,
        screenshot_url,
        description,
        github_username,
        address_line1,
        address_line2,
        city,
        state_province,
        country,
        zip,
        birthday,
        override_hours,
        override_hours_justification,
        status,
        source_project_status,
        ship_kind,
        airtable_record_id,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, NOW()
      )
      ON CONFLICT (project_id, status)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        project_name = EXCLUDED.project_name,
        code_url = EXCLUDED.code_url,
        playable_url = EXCLUDED.playable_url,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        screenshot_url = EXCLUDED.screenshot_url,
        description = EXCLUDED.description,
        github_username = EXCLUDED.github_username,
        address_line1 = EXCLUDED.address_line1,
        address_line2 = EXCLUDED.address_line2,
        city = EXCLUDED.city,
        state_province = EXCLUDED.state_province,
        country = EXCLUDED.country,
        zip = EXCLUDED.zip,
        birthday = EXCLUDED.birthday,
        override_hours = EXCLUDED.override_hours,
        override_hours_justification = EXCLUDED.override_hours_justification,
        source_project_status = EXCLUDED.source_project_status,
        ship_kind = EXCLUDED.ship_kind,
        airtable_record_id = COALESCE(ysws_project_submissions.airtable_record_id, EXCLUDED.airtable_record_id),
        updated_at = NOW()
      RETURNING *
    `,
    submissionValues(submission)
  );

  return result.rows[0];
}

async function updateLocalSubmission(id, submission) {
  const result = await pool.query(
    `
      UPDATE ysws_project_submissions
      SET
        user_id = $2,
        project_name = $3,
        code_url = $4,
        playable_url = $5,
        first_name = $6,
        last_name = $7,
        email = $8,
        screenshot_url = $9,
        description = $10,
        github_username = $11,
        address_line1 = $12,
        address_line2 = $13,
        city = $14,
        state_province = $15,
        country = $16,
        zip = $17,
        birthday = $18,
        override_hours = $19,
        override_hours_justification = $20,
        status = $21,
        source_project_status = $22,
        ship_kind = $23,
        airtable_record_id = COALESCE(airtable_record_id, $24),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, ...submissionValues(submission).slice(1)]
  );

  return result.rows[0];
}

function submissionValues(submission) {
  return [
    submission.project_id,
    submission.user_id,
    submission.project_name,
    submission.code_url,
    submission.playable_url,
    submission.first_name,
    submission.last_name,
    submission.email,
    submission.screenshot_url,
    submission.description,
    submission.github_username,
    submission.address_line1,
    submission.address_line2,
    submission.city,
    submission.state_province,
    submission.country,
    submission.zip,
    submission.birthday,
    submission.override_hours,
    submission.override_hours_justification,
    submission.status,
    submission.source_project_status,
    submission.ship_kind,
    submission.airtable_record_id,
  ];
}

async function persistAirtableRecordId(submission, recordId) {
  if (!recordId || recordId === submission.airtable_record_id) return;

  await pool.query(
    `
      UPDATE ysws_project_submissions
      SET airtable_record_id = $1, updated_at = NOW()
      WHERE id = $2
    `,
    [recordId, submission.id]
  );

  if (submission.status === YSWS_STATUS.approved) {
    await pool.query(
      `UPDATE projects SET ysws_record_id = $1, updated_at = NOW() WHERE id = $2`,
      [recordId, submission.project_id]
    );
  }
}

async function syncSubmissionToAirtable(submission) {
  if (!hasAirtableYswsConfig) {
    return { ok: true, skipped: true, reason: "Airtable YSWS not configured.", submission };
  }

  const fields = buildFieldsFromSubmission(submission);
  let response;
  let created = false;

  if (submission.airtable_record_id) {
    try {
      response = await airtableRequest(`/${submission.airtable_record_id}`, {
        method: "PATCH",
        body: JSON.stringify({ fields }),
      });
    } catch (error) {
      if (/404|NOT_FOUND/i.test(String(error.message))) {
        created = true;
        response = await airtableRequest("", {
          method: "POST",
          body: JSON.stringify({ fields }),
        });
      } else {
        throw error;
      }
    }
  } else {
    created = true;
    response = await airtableRequest("", {
      method: "POST",
      body: JSON.stringify({ fields }),
    });
  }

  await persistAirtableRecordId(submission, response?.id);

  return { ok: true, recordId: response?.id, created, submission };
}

export async function submitProjectToYsws(projectId) {
  if (!pool) {
    return { ok: false, skipped: true, reason: "DATABASE_URL not set." };
  }

  const row = await getProjectContext(projectId);
  if (!row) {
    return { ok: false, skipped: true, reason: "Project not found." };
  }

  const status = yswsStatusForProject(row);
  if (!status) {
    const staleStatuses = [YSWS_STATUS.pending, YSWS_STATUS.pendingReship];
    if (String(row.status || "").toLowerCase() === "blocked") {
      staleStatuses.push(YSWS_STATUS.approved);
    }
    await deleteProjectSubmissions(projectId, staleStatuses);
    return { ok: true, skipped: true, reason: "Project not in YSWS submission state." };
  }

  const localSubmission = await upsertLocalSubmission(
    buildSubmissionFromContext({
      project: row,
      user: { email: row.user_email, raw_profile: row.user_raw_profile, githubUsername: row.user_github_username },
      status,
    })
  );
  const airtableResult = await syncSubmissionToAirtable(localSubmission);

  if (status === YSWS_STATUS.approved) {
    await deleteProjectSubmissions(projectId, [YSWS_STATUS.pending, YSWS_STATUS.pendingReship]);
  }

  return {
    ok: true,
    recordId: airtableResult.recordId,
    projectId,
    status,
    created: airtableResult.created,
    skippedAirtable: airtableResult.skipped,
  };
}
