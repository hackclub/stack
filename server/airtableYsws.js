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
};

const airtableToken =
  process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const airtableBaseId =
  process.env.AIRTABLE_YSWS_BASE_ID || process.env.AIRTABLE_APP || process.env.AIRTABLE_BASE_ID;
const yswsTableId = process.env.AIRTABLE_YSWS_PROJECT_SUBMISSION_TABLE_ID || "tbl3EAvXrfhIkvLNp";

export const hasAirtableYswsConfig = Boolean(airtableToken && airtableBaseId);

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

function buildFieldsFromContext({ project, user, justification }) {
  const identity = extractIdentity(user.raw_profile);
  const address = extractAddress(identity);
  const firstName = identity.first_name ?? identity.firstName ?? null;
  const lastName = identity.last_name ?? identity.lastName ?? null;
  const birthday = identity.birthdate ?? identity.birthday ?? identity.dob ?? null;
  const githubUsername = user.githubUsername || githubFromUrl(project.code_url);

  const fields = {
    [F.codeUrl]: project.code_url || undefined,
    [F.playableUrl]: project.playable_url || undefined,
    [F.firstName]: firstName || undefined,
    [F.lastName]: lastName || undefined,
    [F.email]: user.email || undefined,
    [F.description]: project.description || undefined,
    [F.githubUsername]: githubUsername || undefined,
    [F.addressLine1]: address.line1 || undefined,
    [F.addressLine2]: address.line2 || undefined,
    [F.city]: address.city || undefined,
    [F.stateProvince]: address.stateProvince || undefined,
    [F.country]: address.country || undefined,
    [F.zip]: address.zip || undefined,
    [F.birthday]: airtableDate(birthday),
    [F.overrideHours]: Number.isFinite(Number(project.approved_hours))
      ? Number(Number(project.approved_hours).toFixed(2))
      : undefined,
    [F.overrideHoursJustification]: justification || undefined,
  };

  if (project.image_url) {
    fields[F.screenshot] = [{ url: project.image_url }];
  }

  for (const key of Object.keys(fields)) {
    if (fields[key] === undefined) delete fields[key];
  }

  return fields;
}

export async function submitProjectToYsws(projectId, { forceCreate = false } = {}) {
  if (!hasAirtableYswsConfig) {
    return { ok: false, skipped: true, reason: "Airtable YSWS not configured." };
  }
  if (!pool) {
    return { ok: false, skipped: true, reason: "DATABASE_URL not set." };
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
  if (!row) {
    return { ok: false, skipped: true, reason: "Project not found." };
  }

  if (row.status !== "approved" || !row.reviewed) {
    return { ok: false, skipped: true, reason: "Project not in approved state." };
  }
  if (row.ship_kind === "reship") {
    return { ok: false, skipped: true, reason: "Reship child rows do not submit independently." };
  }

  const fields = buildFieldsFromContext({
    project: row,
    user: { email: row.user_email, raw_profile: row.user_raw_profile, githubUsername: row.user_github_username },
    justification: row.hour_justification,
  });

  let response;
  if (!forceCreate && row.ysws_record_id) {
    try {
      response = await airtableRequest(`/${row.ysws_record_id}`, {
        method: "PATCH",
        body: JSON.stringify({ fields }),
      });
    } catch (error) {
      if (/404|NOT_FOUND/i.test(String(error.message))) {
        response = await airtableRequest("", {
          method: "POST",
          body: JSON.stringify({ fields }),
        });
      } else {
        throw error;
      }
    }
  } else {
    response = await airtableRequest("", {
      method: "POST",
      body: JSON.stringify({ fields }),
    });
  }

  if (response?.id && response.id !== row.ysws_record_id) {
    await pool.query(
      `UPDATE projects SET ysws_record_id = $1, updated_at = NOW() WHERE id = $2`,
      [response.id, projectId]
    );
  }

  return { ok: true, recordId: response?.id, projectId, created: forceCreate || !row.ysws_record_id };
}
