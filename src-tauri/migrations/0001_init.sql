PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  folder_id TEXT NULL,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT NOT NULL,
  auth_method TEXT NOT NULL,
  encrypted_password TEXT NULL,
  encrypted_private_key TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  remark TEXT NOT NULL DEFAULT '',
  color_tag TEXT NULL,
  environment TEXT NOT NULL DEFAULT '无',
  auth_type TEXT NOT NULL DEFAULT 'password',
  proxy_type TEXT NOT NULL DEFAULT '关闭',
  proxy_host TEXT NOT NULL DEFAULT '127.0.0.1',
  proxy_port INTEGER NOT NULL DEFAULT 7890,
  proxy_username TEXT NOT NULL DEFAULT '',
  proxy_password TEXT NOT NULL DEFAULT '',
  proxy_timeout INTEGER NOT NULL DEFAULT 5,
  jump_server_id TEXT NULL,
  preset_id TEXT NULL,
  private_key_id TEXT NULL,
  jump_key_id TEXT NULL,
  encrypted_passphrase TEXT NULL,
  tunnels TEXT NOT NULL DEFAULT '[]',
  env_vars TEXT NOT NULL DEFAULT '[]',
  advanced TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id TEXT NOT NULL,
  command TEXT NOT NULL,
  executed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id TEXT NOT NULL,
  event TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shortcuts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  remark TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ssh_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_type TEXT NOT NULL,
  public_key TEXT NULL,
  has_passphrase INTEGER NOT NULL DEFAULT 0,
  encrypted_private_key TEXT NOT NULL,
  encrypted_passphrase TEXT NULL,
  certificate TEXT NULL,
  remark TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  remark TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  author TEXT NOT NULL DEFAULT '',
  terminal TEXT NOT NULL,
  highlights TEXT NOT NULL,
  ui TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  device_id TEXT NOT NULL,
  last_sync_revision INTEGER NOT NULL DEFAULT 0,
  last_sync_at TEXT NULL,
  local_dirty INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_connections_folder ON connections(folder_id);
CREATE INDEX IF NOT EXISTS idx_connections_name ON connections(name);
CREATE INDEX IF NOT EXISTS idx_connections_host ON connections(host);
CREATE INDEX IF NOT EXISTS idx_history_connection ON history(connection_id, executed_at);
CREATE INDEX IF NOT EXISTS idx_logs_connection ON logs(connection_id, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_event ON logs(event, created_at);
CREATE INDEX IF NOT EXISTS idx_shortcuts_sort ON shortcuts(sort_order);
CREATE INDEX IF NOT EXISTS idx_ssh_keys_name ON ssh_keys(name);
CREATE INDEX IF NOT EXISTS idx_presets_name ON presets(name);
CREATE INDEX IF NOT EXISTS idx_themes_mode ON themes(mode);
