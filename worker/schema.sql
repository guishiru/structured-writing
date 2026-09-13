CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  session_id TEXT,
  referrer_origin TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_created_at
  ON events (created_at);

CREATE INDEX IF NOT EXISTS idx_events_event_name
  ON events (event_name);
