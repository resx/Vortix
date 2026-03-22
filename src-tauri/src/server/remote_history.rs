use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

const DIR_COMMANDS: &str = "commands";
const EXT_COMMAND_HISTORY: &str = "jsonl";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CommandHistoryEntry {
    pub id: i64,
    pub connection_id: String,
    pub command: String,
    pub executed_at: String,
}

pub fn load_command_history_entries(
    base_dir: &Path,
    connection_id: &str,
) -> Result<Option<Vec<CommandHistoryEntry>>, String> {
    let path = command_history_path(base_dir, connection_id);
    if !path.exists() {
        return Ok(None);
    }

    let file = File::open(&path)
        .map_err(|e| format!("failed to open history file {}: {}", path.display(), e))?;
    let reader = BufReader::new(file);
    let mut entries = Vec::new();

    for (line_no, line) in reader.lines().enumerate() {
        let line = line.map_err(|e| {
            format!(
                "failed to read history file {} line {}: {}",
                path.display(),
                line_no + 1,
                e
            )
        })?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        match serde_json::from_str::<CommandHistoryEntry>(trimmed) {
            Ok(entry) => entries.push(entry),
            Err(err) => {
                tracing::warn!(
                    "[Vortix] skipped invalid command history line {} in {}: {}",
                    line_no + 1,
                    path.display(),
                    err
                );
            }
        }
    }

    Ok(Some(entries))
}

pub fn append_command_history(base_dir: &Path, entry: &CommandHistoryEntry) -> Result<(), String> {
    let path = command_history_path(base_dir, &entry.connection_id);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create history dir {}: {}", parent.display(), e))?;
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("failed to open history file {}: {}", path.display(), e))?;
    let line = serde_json::to_string(entry)
        .map_err(|e| format!("failed to serialize history entry: {}", e))?;
    file.write_all(line.as_bytes())
        .and_then(|_| file.write_all(b"\n"))
        .map_err(|e| format!("failed to append history file {}: {}", path.display(), e))
}

pub fn write_command_history_snapshot(
    base_dir: &Path,
    connection_id: &str,
    entries: &[CommandHistoryEntry],
) -> Result<(), String> {
    let path = command_history_path(base_dir, connection_id);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create history dir {}: {}", parent.display(), e))?;
    }

    if entries.is_empty() {
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| format!("failed to remove history file {}: {}", path.display(), e))?;
        }
        return Ok(());
    }

    let mut buf = String::new();
    for entry in entries {
        let line = serde_json::to_string(entry)
            .map_err(|e| format!("failed to serialize history entry: {}", e))?;
        buf.push_str(&line);
        buf.push('\n');
    }

    fs::write(&path, buf)
        .map_err(|e| format!("failed to write history file {}: {}", path.display(), e))
}

pub fn clear_command_history(base_dir: &Path, connection_id: &str) -> Result<(), String> {
    let path = command_history_path(base_dir, connection_id);
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("failed to remove history file {}: {}", path.display(), e))?;
    }
    Ok(())
}

pub fn delete_orphan_command_history_files(
    base_dir: &Path,
    valid_connection_ids: &HashSet<String>,
) -> Result<u64, String> {
    let dir = commands_dir(base_dir);
    if !dir.exists() {
        return Ok(0);
    }

    let mut deleted = 0u64;
    for entry in fs::read_dir(&dir)
        .map_err(|e| format!("failed to read history dir {}: {}", dir.display(), e))?
    {
        let entry =
            entry.map_err(|e| format!("failed to scan history dir {}: {}", dir.display(), e))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let Some(connection_id) = decode_connection_id_from_path(&path) else {
            continue;
        };

        if valid_connection_ids.contains(&connection_id) {
            continue;
        }

        fs::remove_file(&path)
            .map_err(|e| format!("failed to remove history file {}: {}", path.display(), e))?;
        deleted += 1;
    }

    Ok(deleted)
}

pub fn clear_all_remote_history(base_dir: &Path) -> Result<(), String> {
    if !base_dir.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(base_dir).map_err(|e| {
        format!(
            "failed to read remote history dir {}: {}",
            base_dir.display(),
            e
        )
    })? {
        let entry = entry.map_err(|e| {
            format!(
                "failed to scan remote history dir {}: {}",
                base_dir.display(),
                e
            )
        })?;
        let path = entry.path();
        if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|e| {
                format!(
                    "failed to remove history directory {}: {}",
                    path.display(),
                    e
                )
            })?;
        } else {
            fs::remove_file(&path)
                .map_err(|e| format!("failed to remove history file {}: {}", path.display(), e))?;
        }
    }

    fs::create_dir_all(commands_dir(base_dir)).map_err(|e| {
        format!(
            "failed to recreate command history dir {}: {}",
            base_dir.display(),
            e
        )
    })
}

fn commands_dir(base_dir: &Path) -> PathBuf {
    base_dir.join(DIR_COMMANDS)
}

fn command_history_path(base_dir: &Path, connection_id: &str) -> PathBuf {
    let encoded = URL_SAFE_NO_PAD.encode(connection_id.as_bytes());
    commands_dir(base_dir).join(format!("{}.{}", encoded, EXT_COMMAND_HISTORY))
}

fn decode_connection_id_from_path(path: &Path) -> Option<String> {
    let stem = path.file_stem()?.to_str()?;
    let bytes = URL_SAFE_NO_PAD.decode(stem).ok()?;
    String::from_utf8(bytes).ok()
}
