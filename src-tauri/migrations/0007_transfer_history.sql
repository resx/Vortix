CREATE TABLE IF NOT EXISTS transfer_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_key TEXT NOT NULL,
    transfer_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    remote_path TEXT NOT NULL,
    bytes_transferred INTEGER NOT NULL DEFAULT 0,
    file_size INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    error_message TEXT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transfer_history_session_created
ON transfer_history(session_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transfer_history_transfer_id
ON transfer_history(transfer_id);
