import { getAppOrigin } from "./hackclubAuth.js";

const HACKATIME_BASE = "https://hackatime.hackclub.com";
export const HACKATIME_OAUTH_CALLBACK_PATH = "/api/auth/hackatime/callback";

export function isHackatimeOAuthConfigured() {
  return Boolean(process.env.HACKATIME_UID?.trim() && process.env.HACKATIME_SECRET?.trim());
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

export function resolveHackatimeRedirectUri(req) {
  const configured = process.env.HACKATIME_REDIRECT_URI?.trim();
  if (configured) {
    return configured;
  }

  const originHeader = req?.get?.("Origin");
  if (originHeader) {
    try {
      const origin = new URL(originHeader).origin;
      return `${origin}${HACKATIME_OAUTH_CALLBACK_PATH}`;
    } catch {
      // ignore
    }
  }

  const appOrigin = process.env.APP_ORIGIN?.trim() || getAppOrigin();
  return `${appOrigin.replace(/\/$/, "")}${HACKATIME_OAUTH_CALLBACK_PATH}`;
}

export function getHackatimeAuthorizeUrl({ state, redirectUri }) {
  const clientId = requiredEnv("HACKATIME_UID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "profile read",
    state,
  });

  return `${HACKATIME_BASE}/oauth/authorize?${params.toString()}`;
}

export async function exchangeHackatimeAuthorizationCode(code, redirectUri) {
  const clientId = requiredEnv("HACKATIME_UID");
  const clientSecret = requiredEnv("HACKATIME_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: "authorization_code",
  });

  const response = await fetch(`${HACKATIME_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Hackatime token response was not JSON.");
  }

  if (!response.ok) {
    const msg = data.error_description || data.error || response.statusText;
    throw new Error(`Hackatime token exchange failed: ${msg}`);
  }

  return data;
}

export async function refreshHackatimeAccessToken(refreshToken) {
  const clientId = requiredEnv("HACKATIME_UID");
  const clientSecret = requiredEnv("HACKATIME_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(`${HACKATIME_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Hackatime token response was not JSON.");
  }

  if (!response.ok) {
    const msg = data.error_description || data.error || response.statusText;
    throw new Error(`Hackatime token refresh failed: ${msg}`);
  }

  return data;
}

async function hackatimeApiGet(accessToken, path, query = {}) {
  const params = new URLSearchParams(query);
  const qs = params.toString();
  const url = `${HACKATIME_BASE}${path}${qs ? `?${qs}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Hackatime API ${path} returned non-JSON.`);
  }

  if (!response.ok) {
    const msg = data.error || data.message || response.statusText;
    throw new Error(`Hackatime API ${path} failed: ${msg}`);
  }

  return data;
}

export async function fetchHackatimeMe(accessToken) {
  return hackatimeApiGet(accessToken, "/api/v1/authenticated/me");
}

export const STACK_LAUNCH_UTC = new Date("2026-05-28T04:00:00Z");

/** ISO 8601 without fractional seconds (Hackatime accepts this reliably). */
function toHackatimeDateTime(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Stack program window for project stats (ISO 8601). */
export function stackHackatimeStatsRange() {
  return {
    start: toHackatimeDateTime(STACK_LAUNCH_UTC),
    end: toHackatimeDateTime(new Date()),
  };
}

/** Stack program window for /hours (YYYY-MM-DD). */
export function stackHackatimeHoursQuery() {
  const end = new Date();
  return {
    start_date: STACK_LAUNCH_UTC.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

function stackHackatimeWindowQuery() {
  const statsRange = stackHackatimeStatsRange();
  return {
    since: statsRange.start,
    until: statsRange.end,
    start: statsRange.start,
    end: statsRange.end,
  };
}

export async function fetchHackatimeProjects(
  accessToken,
  {
    includeArchived = false,
    start = null,
    end = null,
    since = null,
    until = null,
    projectNames = null,
  } = {}
) {
  const query = { include_archived: includeArchived ? "true" : "false" };
  if (since) query.since = since;
  if (until) query.until = until;
  if (start) query.start = start;
  if (end) query.end = end;
  if (projectNames) query.projects = projectNames;
  const data = await hackatimeApiGet(accessToken, "/api/v1/authenticated/projects", query);

  const projects = Array.isArray(data.projects) ? data.projects : [];
  return projects.map((project) => ({
    name: project.name,
    totalSeconds: Number(project.total_seconds ?? 0),
    totalHours: Number((Number(project.total_seconds ?? 0) / 3600).toFixed(2)),
    languages: project.languages || [],
    archived: Boolean(project.archived),
    mostRecentHeartbeat: project.most_recent_heartbeat ?? null,
  }));
}

function mergeStackHoursOntoCatalog(allProjects, postLaunchProjects) {
  const postLaunchByName = new Map(
    postLaunchProjects.map((project) => [project.name.trim().toLowerCase(), project])
  );
  const mergedByName = new Map();

  for (const project of allProjects) {
    const key = project.name.trim().toLowerCase();
    const post = postLaunchByName.get(key);
    const seconds = post?.totalSeconds ?? 0;
    mergedByName.set(key, {
      ...project,
      totalSeconds: seconds,
      totalHours: Number((seconds / 3600).toFixed(2)),
    });
  }

  for (const project of postLaunchProjects) {
    const key = project.name.trim().toLowerCase();
    if (mergedByName.has(key)) continue;
    mergedByName.set(key, {
      ...project,
      totalSeconds: project.totalSeconds,
      totalHours: project.totalHours,
    });
  }

  return Array.from(mergedByName.values());
}

/** All Hackatime project names for linking, with Stack-era hours attached. */
export async function fetchHackatimeProjectCatalog(accessToken) {
  const statsRange = stackHackatimeStatsRange();
  const allTimeDiscovery = {
    since: "1970-01-01T00:00:00Z",
    until: statsRange.end,
    start: "1970-01-01T00:00:00Z",
    end: statsRange.end,
    includeArchived: true,
  };
  const stackWindow = {
    ...stackHackatimeWindowQuery(),
    includeArchived: true,
  };

  const [allProjects, postLaunchProjects] = await Promise.all([
    fetchHackatimeProjects(accessToken, allTimeDiscovery),
    fetchHackatimeProjects(accessToken, stackWindow),
  ]);

  return mergeStackHoursOntoCatalog(allProjects, postLaunchProjects);
}

/** Fetch Stack-era hours for specific linked project names (bypasses discovery gaps). */
export async function fetchHackatimeProjectsForLinkedNames(accessToken, linkedNames) {
  const names = [
    ...new Set(
      (Array.isArray(linkedNames) ? linkedNames : [])
        .map((name) => String(name).trim())
        .filter(Boolean)
    ),
  ];
  if (names.length === 0) return [];

  return fetchHackatimeProjects(accessToken, {
    ...stackHackatimeWindowQuery(),
    includeArchived: true,
    projectNames: names.join(","),
  });
}

/** @deprecated Use fetchHackatimeProjectCatalog or fetchHackatimeProjectsForLinkedNames. */
export async function fetchHackatimeProjectsForStack(accessToken) {
  return fetchHackatimeProjectCatalog(accessToken);
}

export async function fetchHackatimeTotalHours(accessToken) {
  const data = await hackatimeApiGet(
    accessToken,
    "/api/v1/authenticated/hours",
    stackHackatimeHoursQuery()
  );
  const seconds = Number(data.total_seconds ?? 0);
  return {
    totalSeconds: seconds,
    totalHours: Number((seconds / 3600).toFixed(2)),
    startDate: data.start_date ?? null,
    endDate: data.end_date ?? null,
  };
}

export function sumHackatimeHoursForNames(hackatimeProjects, linkedNames) {
  const names = new Set(
    (Array.isArray(linkedNames) ? linkedNames : [])
      .map((name) => String(name).trim().toLowerCase())
      .filter(Boolean)
  );
  if (names.size === 0) return 0;

  let seconds = 0;
  for (const project of hackatimeProjects) {
    if (names.has(String(project.name).trim().toLowerCase())) {
      seconds += Number(project.totalSeconds ?? 0);
    }
  }

  return Number((seconds / 3600).toFixed(2));
}
