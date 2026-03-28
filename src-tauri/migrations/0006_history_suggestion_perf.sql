CREATE INDEX IF NOT EXISTS idx_history_connection_command_id
ON history(connection_id, command, id DESC);
