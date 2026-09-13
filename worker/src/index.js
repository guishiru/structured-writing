const ALLOWED_EVENTS = new Set(["page_view", "download_click", "github_click"]);

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get("Origin") || "";
  const allowedOrigin = env.ALLOWED_ORIGIN || "*";
  const allowOrigin = allowedOrigin === "*" || requestOrigin === allowedOrigin
    ? allowedOrigin
    : "null";

  return {
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": allowOrigin,
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin"
  };
}

function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request, env)
  });
}

function limit(value, max) {
  return String(value || "").slice(0, max);
}

function referrerOrigin(value) {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch (error) {
    return "";
  }
}

async function recordEvent(request, env, event) {
  if (!env.DB) {
    throw new Error("D1 binding DB is not configured");
  }

  const data = {
    event_name: limit(event.event, 40),
    resource_id: limit(event.resource_id, 255),
    session_id: limit(event.session_id, 120),
    referrer_origin: referrerOrigin(event.referrer),
    utm_source: limit(event.utm_source, 100),
    utm_medium: limit(event.utm_medium, 100),
    utm_campaign: limit(event.utm_campaign, 100)
  };

  if (event.owner_mode === true ||
      !ALLOWED_EVENTS.has(data.event_name) ||
      !data.resource_id) {
    return false;
  }

  await env.DB.prepare(
    `INSERT INTO events
      (event_name, resource_id, session_id, referrer_origin, utm_source, utm_medium, utm_campaign)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    data.event_name,
    data.resource_id,
    data.session_id,
    data.referrer_origin,
    data.utm_source,
    data.utm_medium,
    data.utm_campaign
  ).run();

  return true;
}

async function handleEvent(request, env) {
  if (request.headers.get("Content-Length") > 16384) {
    return json(request, env, { error: "payload too large" }, 413);
  }

  let event;
  try {
    event = await request.json();
  } catch (error) {
    return json(request, env, { error: "invalid JSON" }, 400);
  }

  try {
    const recorded = await recordEvent(request, env, event);
    return json(request, env, { ok: recorded });
  } catch (error) {
    return json(request, env, { error: "storage unavailable" }, 503);
  }
}

async function handleSummary(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!env.ADMIN_TOKEN || authorization !== `Bearer ${env.ADMIN_TOKEN}`) {
    return json(request, env, { error: "unauthorized" }, 401);
  }

  const result = await env.DB.prepare(
    `SELECT event_name, COUNT(*) AS count
     FROM events
     WHERE created_at >= datetime('now', '-30 days')
     GROUP BY event_name
     ORDER BY count DESC`
  ).all();

  const daily = await env.DB.prepare(
    `SELECT substr(created_at, 1, 10) AS day, event_name, COUNT(*) AS count
     FROM events
     WHERE created_at >= datetime('now', '-30 days')
     GROUP BY day, event_name
     ORDER BY day ASC, event_name ASC`
  ).all();

  return json(request, env, { totals: result.results, daily: daily.results });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request, env) });
    }

    if (request.method === "POST" && url.pathname === "/api/events") {
      return handleEvent(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/summary") {
      return handleSummary(request, env);
    }

    if (request.method === "GET" && url.pathname === "/download") {
      try {
        await recordEvent(request, env, {
          event: "download_click",
          resource_id: "structured-writing.plugin",
          referrer: request.headers.get("Referer") || ""
        });
      } catch (error) {
        // A failed metric must not block the actual download.
      }

      return Response.redirect(
        env.RELEASE_URL ||
          "https://github.com/guishiru/structured-writing/releases/latest/download/structured-writing.plugin",
        302
      );
    }

    return json(request, env, { error: "not found" }, 404);
  }
};
