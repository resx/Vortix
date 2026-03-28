use axum::body::Bytes;
use axum::{
    extract::State,
    http::{StatusCode, header},
    response::Json,
    response::Response as AxumResponse,
};
use flate2::{Compression, write::GzEncoder};
use serde_json::{Value, json};
use std::io::Write as IoWrite;
use uuid::Uuid;

use crate::db::Db;
use crate::server::helpers::mark_local_dirty;
use crate::server::response::{ApiResponse, err, ok, ok_empty};
use crate::server::types::{CreateSshKeyDto, SshKeyRawRow, SshKeyRow, UpdateSshKeyDto};
use crate::time_utils::now_rfc3339;

use super::archive::{build_tar, sanitize_filename};

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
    let now = now_rfc3339();
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
