use anyhow::Result;
use sqlx::SqlitePool;

use crate::time_utils::now_rfc3339;

pub enum TransferDirection {
    Upload,
    Download,
}

impl TransferDirection {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Upload => "upload",
            Self::Download => "download",
        }
    }
}

pub enum TransferStatus {
    Completed,
    Failed,
    Canceled,
}

impl TransferStatus {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Canceled => "canceled",
        }
    }
}

pub async fn append_transfer_history(
    pool: &SqlitePool,
    session_key: &str,
    transfer_id: &str,
    direction: TransferDirection,
    remote_path: &str,
    bytes_transferred: i64,
    file_size: i64,
    status: TransferStatus,
    error_message: Option<&str>,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO transfer_history (
            session_key, transfer_id, direction, remote_path,
            bytes_transferred, file_size, status, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(session_key)
    .bind(transfer_id)
    .bind(direction.as_str())
    .bind(remote_path)
    .bind(bytes_transferred)
    .bind(file_size)
    .bind(status.as_str())
    .bind(error_message)
    .bind(now_rfc3339())
    .execute(pool)
    .await?;
    Ok(())
}
