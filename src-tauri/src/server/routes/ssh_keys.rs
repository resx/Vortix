/* ── SSH 密钥 CRUD + 导出 + 生成 ── */

use axum::body::Bytes;
use axum::{
    extract::State,
    http::{StatusCode, header},
    response::Json,
    response::Response as AxumResponse,
};
use chrono::Utc;
use flate2::{Compression, write::GzEncoder};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::fs;
use std::io::Write as IoWrite;
use std::process::Command;
use uuid::Uuid;

use super::super::helpers::mark_local_dirty;
use super::super::response::{ApiResponse, err, ok, ok_empty};
use super::super::types::*;
use crate::db::Db;

pub async fn get_ssh_keys(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Vec<SshKeyRow>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows = sqlx::query_as::<_, SshKeyRow>(
        "SELECT id, name, key_type, public_key, has_passphrase, certificate, remark, description, created_at FROM ssh_keys ORDER BY created_at DESC",
    )
    .fetch_all(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(rows))
}

pub async fn get_ssh_key(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<SshKeyRow>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let row = sqlx::query_as::<_, SshKeyRow>(
        "SELECT id, name, key_type, public_key, has_passphrase, certificate, remark, description, created_at FROM ssh_keys WHERE id = ?",
    )
    .bind(&id).fetch_optional(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(row) = row else {
        return Err(err(StatusCode::NOT_FOUND, "密钥不存在"));
    };
    Ok(ok(row))
}

pub async fn get_ssh_key_private(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let row = sqlx::query_as::<_, SshKeyRawRow>(
        "SELECT id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at FROM ssh_keys WHERE id = ?",
    )
    .bind(&id).fetch_optional(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(row) = row else {
        return Err(err(StatusCode::NOT_FOUND, "密钥不存在"));
    };
    let private_key = db
        .crypto
        .decrypt(&row.encrypted_private_key)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(json!({ "private_key": private_key })))
}

pub async fn get_ssh_key_credential(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let row = sqlx::query_as::<_, SshKeyRawRow>(
        "SELECT id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at FROM ssh_keys WHERE id = ?",
    )
    .bind(&id).fetch_optional(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(row) = row else {
        return Err(err(StatusCode::NOT_FOUND, "密钥不存在"));
    };
    let private_key = db
        .crypto
        .decrypt(&row.encrypted_private_key)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let passphrase = match row.encrypted_passphrase {
        Some(ref enc) => Some(
            db.crypto
                .decrypt(enc)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        None => None,
    };
    Ok(ok(
        json!({ "private_key": private_key, "passphrase": passphrase }),
    ))
}

pub async fn create_ssh_key(
    State(db): State<Db>,
    Json(body): Json<CreateSshKeyDto>,
) -> Result<Json<ApiResponse<SshKeyRow>>, (StatusCode, Json<ApiResponse<Value>>)> {
    if body.name.trim().is_empty() || body.private_key.trim().is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "名称和私钥不能为空"));
    }
    if body.name.len() > 255 {
        return Err(err(StatusCode::BAD_REQUEST, "名称长度不能超过 255"));
    }
    let encrypted_private_key = db
        .crypto
        .encrypt(&body.private_key)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let encrypted_passphrase = match body.passphrase {
        Some(ref pass) if !pass.trim().is_empty() => Some(
            db.crypto
                .encrypt(pass)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        _ => None,
    };
    let key_type = body.key_type.unwrap_or_else(|| "unknown".to_string());
    let description = body.description.unwrap_or_default();
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let remark = body.remark.unwrap_or_default();

    sqlx::query(
        "INSERT INTO ssh_keys (id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id).bind(&body.name).bind(&key_type).bind(&body.public_key)
    .bind(if encrypted_passphrase.is_some() { 1 } else { 0 })
    .bind(&encrypted_private_key).bind(&encrypted_passphrase)
    .bind(&body.certificate).bind(&remark).bind(&description).bind(&now)
    .execute(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    mark_local_dirty(&db).await?;

    Ok(ok(SshKeyRow {
        id,
        name: body.name,
        key_type,
        public_key: body.public_key,
        has_passphrase: if encrypted_passphrase.is_some() { 1 } else { 0 },
        certificate: body.certificate,
        remark,
        description,
        created_at: now,
    }))
}

pub async fn update_ssh_key(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<UpdateSshKeyDto>,
) -> Result<Json<ApiResponse<SshKeyRow>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let existing = sqlx::query_as::<_, SshKeyRawRow>(
        "SELECT id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at FROM ssh_keys WHERE id = ?",
    )
    .bind(&id).fetch_optional(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(existing) = existing else {
        return Err(err(StatusCode::NOT_FOUND, "密钥不存在"));
    };

    let name = body.name.unwrap_or(existing.name.clone());
    let public_key = body.public_key.or(existing.public_key.clone());
    let certificate = body.certificate.or(existing.certificate.clone());
    let remark = body.remark.unwrap_or(existing.remark.clone());
    let encrypted_private_key = match body.private_key {
        Some(ref key) if !key.trim().is_empty() => db
            .crypto
            .encrypt(key)
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        _ => existing.encrypted_private_key.clone(),
    };
    let encrypted_passphrase = match body.passphrase {
        Some(ref pass) if !pass.trim().is_empty() => Some(
            db.crypto
                .encrypt(pass)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        Some(_) => None,
        None => existing.encrypted_passphrase.clone(),
    };
    let has_passphrase = if encrypted_passphrase.is_some() { 1 } else { 0 };

    sqlx::query(
        "UPDATE ssh_keys SET name = ?, public_key = ?, encrypted_private_key = ?, encrypted_passphrase = ?, has_passphrase = ?, certificate = ?, remark = ? WHERE id = ?",
    )
    .bind(&name).bind(&public_key).bind(&encrypted_private_key)
    .bind(&encrypted_passphrase).bind(has_passphrase).bind(&certificate).bind(&remark).bind(&id)
    .execute(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    mark_local_dirty(&db).await?;

    Ok(ok(SshKeyRow {
        id,
        name,
        key_type: existing.key_type,
        public_key,
        has_passphrase,
        certificate,
        remark,
        description: existing.description,
        created_at: existing.created_at,
    }))
}

pub async fn delete_ssh_key(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let result = sqlx::query("DELETE FROM ssh_keys WHERE id = ?")
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err(err(StatusCode::NOT_FOUND, "密钥不存在"));
    }
    sqlx::query("UPDATE connections SET private_key_id = NULL, jump_key_id = NULL, auth_type = 'password' WHERE private_key_id = ? OR jump_key_id = ?")
        .bind(&id).bind(&id).execute(&db.pool).await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    mark_local_dirty(&db).await?;
    Ok(ok_empty())
}

pub async fn export_ssh_key(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<AxumResponse, (StatusCode, Json<ApiResponse<Value>>)> {
    let row = sqlx::query_as::<_, SshKeyRawRow>(
        "SELECT id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at FROM ssh_keys WHERE id = ?",
    )
    .bind(&id).fetch_optional(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(row) = row else {
        return Err(err(StatusCode::NOT_FOUND, "密钥不存在"));
    };

    let private_key = db
        .crypto
        .decrypt(&row.encrypted_private_key)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let passphrase = match row.encrypted_passphrase {
        Some(ref enc) => Some(
            db.crypto
                .decrypt(enc)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        None => None,
    };

    let mut files: Vec<(String, String)> = Vec::new();
    let prefix = sanitize_filename(&row.name);
    files.push((format!("{}/private_key", prefix), private_key));
    if let Some(pubkey) = row.public_key {
        files.push((format!("{}/public_key.pub", prefix), pubkey));
    }
    if let Some(pp) = passphrase {
        files.push((format!("{}/passphrase.txt", prefix), pp));
    }
    if let Some(cert) = row.certificate {
        files.push((format!("{}/certificate.pem", prefix), cert));
    }

    let tar = build_tar(&files);
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(&tar)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let gz = encoder
        .finish()
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut resp = AxumResponse::new(Bytes::from(gz).into());
    *resp.status_mut() = StatusCode::OK;
    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        header::HeaderValue::from_static("application/gzip"),
    );
    let filename = format!("{}.tar.gz", sanitize_filename(&row.name));
    resp.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        header::HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename)).unwrap(),
    );
    Ok(resp)
}

pub async fn generate_ssh_key(
    State(db): State<Db>,
    Json(body): Json<GenerateSshKeyDto>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    if body.name.trim().is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "密钥名称不能为空"));
    }
    if body.name.len() > 255 {
        return Err(err(StatusCode::BAD_REQUEST, "密钥名称长度不能超过 255"));
    }

    let key_type = body.key_type.as_str();
    let allowed_bits: HashMap<&str, Vec<u32>> = HashMap::from([
        ("rsa", vec![2048, 3072, 4096]),
        ("ecdsa", vec![256, 384, 521]),
        ("ml-dsa", vec![44, 65, 87]),
    ]);
    if let Some(bits) = body.bits {
        if let Some(list) = allowed_bits.get(key_type) {
            if !list.contains(&bits) {
                return Err(err(
                    StatusCode::BAD_REQUEST,
                    format!("{} 不支持的 bits 值: {}", key_type, bits),
                ));
            }
        }
    }
    if key_type == "ml-dsa" {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "Rust 端暂不支持 ML-DSA，请选择其他密钥类型",
        ));
    }
    let bits = match key_type {
        "rsa" => Some(body.bits.unwrap_or(2048)),
        "ecdsa" => Some(body.bits.unwrap_or(256)),
        "ed25519" => None,
        _ => {
            return Err(err(
                StatusCode::BAD_REQUEST,
                format!("不支持的密钥类型: {}", key_type),
            ));
        }
    };

    let (private_key, public_key_raw) = generate_keypair_with_ssh_keygen(
        key_type,
        bits,
        body.passphrase.as_deref(),
        body.comment.as_deref(),
    )
    .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;

    let public_key = append_vortix_tag(&public_key_raw);
    let encrypted_private_key = db
        .crypto
        .encrypt(&private_key)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let encrypted_passphrase = match body.passphrase {
        Some(ref pass) if !pass.trim().is_empty() => Some(
            db.crypto
                .encrypt(pass)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        _ => None,
    };

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO ssh_keys (id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id).bind(&body.name).bind(&body.key_type).bind(&public_key)
    .bind(if encrypted_passphrase.is_some() { 1 } else { 0 })
    .bind(&encrypted_private_key).bind(&encrypted_passphrase)
    .bind(Option::<String>::None).bind("").bind("").bind(&now)
    .execute(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(ok(json!({
        "id": id, "name": body.name, "key_type": body.key_type,
        "public_key": public_key, "has_passphrase": if encrypted_passphrase.is_some() { 1 } else { 0 },
        "certificate": null, "remark": "", "description": "", "created_at": now,
        "publicKey": public_key,
    })))
}

/* ── 辅助函数 ── */

fn sanitize_filename(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' || ch == ' ' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        "key".to_string()
    } else {
        out
    }
}

fn build_tar(files: &[(String, String)]) -> Vec<u8> {
    let mut blocks: Vec<u8> = Vec::new();
    for (name, content) in files {
        let content_bytes = content.as_bytes();
        let mut header = [0u8; 512];
        let name_bytes = name.as_bytes();
        let copy_len = name_bytes.len().min(100);
        header[..copy_len].copy_from_slice(&name_bytes[..copy_len]);
        write_octal(&mut header[100..108], 0o644, 8);
        write_octal(&mut header[108..116], 0, 8);
        write_octal(&mut header[116..124], 0, 8);
        write_octal(&mut header[124..136], content_bytes.len() as u64, 12);
        write_octal(&mut header[136..148], (Utc::now().timestamp()) as u64, 12);
        header[156] = b'0';
        header[257..263].copy_from_slice(b"ustar\0");
        header[263..265].copy_from_slice(b"00");
        for i in 148..156 {
            header[i] = b' ';
        }
        let checksum: u32 = header.iter().map(|b| *b as u32).sum();
        write_octal(&mut header[148..156], checksum as u64, 8);
        blocks.extend_from_slice(&header);
        blocks.extend_from_slice(content_bytes);
        let pad = 512 - (content_bytes.len() % 512);
        if pad < 512 {
            blocks.extend_from_slice(&vec![0u8; pad]);
        }
    }
    blocks.extend_from_slice(&[0u8; 1024]);
    blocks
}

fn write_octal(buf: &mut [u8], value: u64, width: usize) {
    let s = format!("{:0width$o}\0", value, width = width - 1);
    let bytes = s.as_bytes();
    let len = bytes.len().min(buf.len());
    buf[..len].copy_from_slice(&bytes[..len]);
}

fn append_vortix_tag(public_key: &str) -> String {
    let trimmed = public_key.trim_end();
    if trimmed.starts_with("-----") {
        format!("{}\n# [Generated by Vortix]\n", trimmed)
    } else {
        format!("{} [Generated by Vortix]\n", trimmed)
    }
}

fn run_ssh_keygen(path: &str, args: &[String]) -> Result<(), std::io::Error> {
    let output = Command::new(path).args(args).output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let msg = if stderr.is_empty() {
            format!("ssh-keygen 退出码: {:?}", output.status.code())
        } else {
            stderr
        };
        return Err(std::io::Error::new(std::io::ErrorKind::Other, msg));
    }
    Ok(())
}

fn generate_keypair_with_ssh_keygen(
    key_type: &str,
    bits: Option<u32>,
    passphrase: Option<&str>,
    comment: Option<&str>,
) -> Result<(String, String), String> {
    let temp_dir = std::env::temp_dir().join(format!("vortix-key-{}", Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let key_path = temp_dir.join("id_key");

    let mut args: Vec<String> = Vec::new();
    args.push("-t".to_string());
    args.push(key_type.to_string());
    if let Some(b) = bits {
        args.push("-b".to_string());
        args.push(b.to_string());
    }
    if let Some(c) = comment {
        if !c.trim().is_empty() {
            args.push("-C".to_string());
            args.push(c.to_string());
        }
    }
    args.push("-f".to_string());
    args.push(key_path.to_string_lossy().to_string());
    args.push("-N".to_string());
    args.push(passphrase.unwrap_or("").to_string());
    args.push("-q".to_string());

    let mut ran = false;
    let mut last_err: Option<String> = None;
    let candidates = [
        "ssh-keygen",
        "C:\\Windows\\System32\\OpenSSH\\ssh-keygen.exe",
        "C:\\Program Files\\OpenSSH-Win64\\ssh-keygen.exe",
    ];
    for path in candidates {
        match run_ssh_keygen(path, &args) {
            Ok(_) => {
                ran = true;
                break;
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                last_err = Some(format!("未找到 {}", path));
                continue;
            }
            Err(e) => {
                last_err = Some(e.to_string());
                break;
            }
        }
    }
    if !ran {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(last_err.unwrap_or_else(|| "无法执行 ssh-keygen，请安装 OpenSSH".to_string()));
    }

    let private_key = fs::read_to_string(&key_path).map_err(|e| e.to_string())?;
    let public_key =
        fs::read_to_string(key_path.with_extension("pub")).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&key_path);
    let _ = fs::remove_file(key_path.with_extension("pub"));
    let _ = fs::remove_dir_all(&temp_dir);
    Ok((private_key, public_key))
}
