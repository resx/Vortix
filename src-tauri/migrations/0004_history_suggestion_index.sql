CREATE INDEX IF NOT EXISTS idx_history_connection_id ON history(connection_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_history_connection_command ON history(connection_id, command);
