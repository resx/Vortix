use chrono::Local;
use russh_sftp::client::SftpSession;
use russh_sftp::client::fs::Metadata;
use serde_json::{Value, json};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

pub(super) fn sftp_entry_from_meta(path: &str, meta: &Metadata) -> Value {
    let name = path.rsplit('/').next().unwrap_or(path).to_string();
    let mtime = meta.mtime.unwrap_or(0) as i64;
    let modified_at = chrono::DateTime::<chrono::Utc>::from_timestamp(mtime, 0)
        .unwrap_or_else(|| chrono::DateTime::<chrono::Utc>::from_timestamp(0, 0).unwrap())
        .with_timezone(&Local)
        .to_rfc3339();
    let perm = meta.permissions.unwrap_or(0);
    json!({
        "name": name, "path": path,
        "type": sftp_type_from_meta(meta),
        "size": meta.size.unwrap_or(0) as i64,
        "modifiedAt": modified_at,
        "permissions": sftp_mode_to_permissions(perm & 0o777),
        "owner": meta.uid.unwrap_or(0),
        "group": meta.gid.unwrap_or(0),
    })
}

fn sftp_mode_to_permissions(mode: u32) -> String {
    let perms = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
    let owner = perms[((mode >> 6) & 7) as usize];
    let group = perms[((mode >> 3) & 7) as usize];
    let other = perms[(mode & 7) as usize];
    format!("{}{}{}", owner, group, other)
}

fn sftp_type_from_meta(meta: &Metadata) -> &'static str {
    if meta.is_dir() {
        "dir"
    } else if meta.is_regular() {
        "file"
    } else {
        "symlink"
    }
}

pub(super) async fn read_text_file(sftp: &SftpSession, path: &str) -> Result<String, String> {
    let meta = sftp.metadata(path).await.map_err(|e| e.to_string())?;
    let size = meta.size.unwrap_or(0);
    if size > 10 * 1024 * 1024 {
        return Err(format!(
            "文件过大（{}MB），最大允许 10MB",
            (size as f64 / 1024.0 / 1024.0).ceil()
        ));
    }
    let mut file = sftp.open(path).await.map_err(|e| e.to_string())?;
    let mut content = Vec::new();
    file.read_to_end(&mut content)
        .await
        .map_err(|e| e.to_string())?;
    String::from_utf8(content).map_err(|e| format!("UTF-8 解析失败: {}", e))
}

pub(super) async fn write_text_file(
    sftp: &SftpSession,
    path: &str,
    content: &str,
) -> Result<(), String> {
    let mut file = sftp.create(path).await.map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    file.shutdown().await.map_err(|e| e.to_string())?;
    Ok(())
}

pub(super) async fn remove_dir_recursive(sftp: &SftpSession, path: &str) -> Result<(), String> {
    let entries = sftp.read_dir(path).await.map_err(|e| e.to_string())?;
    for entry in entries {
        let name = entry.file_name();
        if name == "." || name == ".." {
            continue;
        }
        let full = format!("{}/{}", path.trim_end_matches('/'), name);
        if entry.metadata().is_dir() {
            Box::pin(remove_dir_recursive(sftp, &full)).await?;
        } else {
            sftp.remove_file(&full).await.map_err(|e| e.to_string())?;
        }
    }
    sftp.remove_dir(path).await.map_err(|e| e.to_string())?;
    Ok(())
}

pub(super) async fn chmod_entry(
    sftp: &SftpSession,
    path: &str,
    mode: u32,
    recursive: bool,
) -> Result<(), String> {
    if recursive {
        Box::pin(chmod_recursive(sftp, path, mode)).await
    } else {
        set_perm(sftp, path, mode).await
    }
}

async fn set_perm(sftp: &SftpSession, path: &str, mode: u32) -> Result<(), String> {
    let mut meta = Metadata::default();
    meta.permissions = Some(mode);
    sftp.set_metadata(path, meta)
        .await
        .map_err(|e| e.to_string())
}

async fn chmod_recursive(sftp: &SftpSession, path: &str, mode: u32) -> Result<(), String> {
    set_perm(sftp, path, mode).await?;
    let entries = sftp.read_dir(path).await.map_err(|e| e.to_string())?;
    for entry in entries {
        let name = entry.file_name();
        if name == "." || name == ".." {
            continue;
        }
        let full = format!("{}/{}", path.trim_end_matches('/'), name);
        if entry.metadata().is_dir() {
            Box::pin(chmod_recursive(sftp, &full, mode)).await?;
        } else {
            set_perm(sftp, &full, mode).await?;
        }
    }
    Ok(())
}
