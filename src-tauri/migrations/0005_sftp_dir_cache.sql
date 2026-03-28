CREATE TABLE IF NOT EXISTS sftp_dir_cache (
    session_key TEXT NOT NULL,
    path TEXT NOT NULL,
    payload TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_key, path)
);

CREATE INDEX IF NOT EXISTS idx_sftp_dir_cache_expires_at ON sftp_dir_cache(expires_at);
