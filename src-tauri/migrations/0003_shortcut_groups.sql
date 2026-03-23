CREATE TABLE IF NOT EXISTS shortcut_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shortcut_groups_sort ON shortcut_groups(sort_order, name);

INSERT OR IGNORE INTO shortcut_groups (id, name, sort_order, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  trim(group_name),
  0,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM shortcuts
WHERE trim(group_name) <> '';
