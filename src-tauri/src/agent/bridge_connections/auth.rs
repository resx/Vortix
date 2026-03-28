use crate::db::Db;
use crate::server::types::{PresetRow, SshKeyRawRow};

use super::types::{ConnectionCredentialRecord, JumpCredential, RawConnectionCredentialRow, ResolvedAuth};

async fn resolve_key_material(
    db: &Db,
    key_id: Option<&str>,
) -> Result<(Option<String>, Option<String>), String> {
    let Some(key_id) = key_id else {
        return Ok((None, None));
    };
    let key_row = sqlx::query_as::<_, SshKeyRawRow>(
        "SELECT id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at FROM ssh_keys WHERE id = ?",
    )
    .bind(key_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| e.to_string())?;

    let Some(key_row) = key_row else {
        return Ok((None, None));
    };

    let private_key = Some(
        db.crypto
            .decrypt(&key_row.encrypted_private_key)
            .map_err(|e| e.to_string())?,
    );
    let passphrase = match key_row.encrypted_passphrase {
        Some(enc) => Some(db.crypto.decrypt(&enc).map_err(|e| e.to_string())?),
        None => None,
    };
    Ok((private_key, passphrase))
}

async fn resolve_connection_auth(db: &Db, row: &RawConnectionCredentialRow) -> Result<ResolvedAuth, String> {
    let mut username = row.username.clone();
    let mut password: Option<String> = None;
    let mut private_key: Option<String> = None;
    let mut passphrase: Option<String> = None;

    if let Some(preset_id) = &row.preset_id {
        let preset = sqlx::query_as::<_, PresetRow>("SELECT * FROM presets WHERE id = ?")
            .bind(preset_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| e.to_string())?;
        if let Some(preset) = preset {
            username = preset.username;
            password = Some(
                db.crypto
                    .decrypt(&preset.encrypted_password)
                    .map_err(|e| e.to_string())?,
            );
        }
    } else if let Some(enc_pwd) = &row.encrypted_password {
        if !enc_pwd.is_empty() {
            password = Some(db.crypto.decrypt(enc_pwd).map_err(|e| e.to_string())?);
        }
    }

    let (key_private_key, key_passphrase) =
        resolve_key_material(db, row.private_key_id.as_deref()).await?;
    if key_private_key.is_some() {
        private_key = key_private_key;
        passphrase = key_passphrase;
    } else if let Some(enc_key) = &row.encrypted_private_key {
        if !enc_key.is_empty() {
            private_key = Some(db.crypto.decrypt(enc_key).map_err(|e| e.to_string())?);
            if let Some(enc_pp) = &row.encrypted_passphrase {
                if !enc_pp.is_empty() {
                    passphrase = Some(db.crypto.decrypt(enc_pp).map_err(|e| e.to_string())?);
                }
            }
        }
    }

    if row.auth_type == "jump" && private_key.is_none() {
        let (jump_key_private, jump_key_passphrase) =
            resolve_key_material(db, row.jump_key_id.as_deref()).await?;
        if jump_key_private.is_some() {
            private_key = jump_key_private;
            passphrase = jump_key_passphrase;
            password = None;
        }
    }

    Ok(ResolvedAuth {
        username,
        password,
        private_key,
        passphrase,
    })
}

async fn resolve_jump_credential(db: &Db, jump_server_id: Option<&str>) -> Result<Option<JumpCredential>, String> {
    let Some(jump_server_id) = jump_server_id else {
        return Ok(None);
    };
    let jump_row = sqlx::query_as::<_, RawConnectionCredentialRow>(
        "SELECT id, name, host, port, username, auth_type, preset_id, private_key_id, jump_key_id, jump_server_id, encrypted_password, encrypted_private_key, encrypted_passphrase, proxy_password FROM connections WHERE id = ?",
    )
    .bind(jump_server_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| e.to_string())?;
    let Some(jump_row) = jump_row else {
        return Ok(None);
    };

    let auth = resolve_connection_auth(db, &jump_row).await?;
    Ok(Some(JumpCredential {
        connection_id: Some(jump_row.id),
        connection_name: Some(jump_row.name),
        host: jump_row.host,
        port: jump_row.port,
        username: auth.username,
        password: auth.password,
        private_key: auth.private_key,
        passphrase: auth.passphrase,
    }))
}

pub async fn get_connection_credential(
    db: &Db,
    id: String,
) -> Result<ConnectionCredentialRecord, String> {
    let row = sqlx::query_as::<_, RawConnectionCredentialRow>(
        "SELECT id, name, host, port, username, auth_type, preset_id, private_key_id, jump_key_id, jump_server_id, encrypted_password, encrypted_private_key, encrypted_passphrase, proxy_password FROM connections WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| e.to_string())?;
    let Some(row) = row else {
        return Err("连接不存在".to_string());
    };

    let auth = resolve_connection_auth(db, &row).await?;
    let jump = resolve_jump_credential(db, row.jump_server_id.as_deref()).await?;
    let proxy_password = if row.proxy_password.is_empty() {
        None
    } else {
        Some(
            db.crypto
                .decrypt(&row.proxy_password)
                .map_err(|e| e.to_string())?,
        )
    };

    Ok(ConnectionCredentialRecord {
        host: row.host,
        port: row.port,
        username: auth.username,
        password: auth.password,
        private_key: auth.private_key,
        passphrase: auth.passphrase,
        jump,
        proxy_password,
    })
}
