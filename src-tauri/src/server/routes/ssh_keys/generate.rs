use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::fs;
use std::process::Command;
use uuid::Uuid;

use crate::db::Db;
use crate::server::response::{ApiResponse, err, ok};
use crate::server::types::GenerateSshKeyDto;
use crate::time_utils::now_rfc3339;

use super::archive::append_vortix_tag;

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
    let now = now_rfc3339();

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
