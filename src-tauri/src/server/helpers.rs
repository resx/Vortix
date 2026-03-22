/* ── 共享工具函数 ── */

use axum::http::StatusCode;
use russh::client;
use russh::keys::PrivateKeyWithHashAlg;
use russh::keys::ssh_key::PublicKey;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::db::Db;
use crate::server::known_hosts::{self, HostKeyCheck};

use super::response::{ApiError, err};
use super::types::*;

/* ── russh 基础 ── */

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostKeyConnectDecision {
    Reject,
    Trust,
    Replace,
}

#[derive(Debug, Clone)]
pub struct HostKeyVerificationPrompt {
    pub reason: &'static str,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub connection_id: Option<String>,
    pub connection_name: Option<String>,
    pub key_type: String,
    pub fingerprint_sha256: String,
    pub known_key_type: Option<String>,
    pub known_fingerprint_sha256: Option<String>,
}

#[derive(Debug, Clone)]
enum KnownHostsConnectFailure {
    Prompt(HostKeyVerificationPrompt),
    Error(String),
}

#[derive(Clone)]
pub struct KnownHostsHandler {
    known_hosts_path: PathBuf,
    host: String,
    port: u16,
    username: String,
    connection_id: Option<String>,
    connection_name: Option<String>,
    decision: HostKeyConnectDecision,
    failure: Arc<Mutex<Option<KnownHostsConnectFailure>>>,
}

#[derive(Debug, Clone)]
pub struct RusshEndpoint {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub connection_id: Option<String>,
    pub connection_name: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct RusshAuthConfig {
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub passphrase: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RusshJumpHostConfig {
    pub endpoint: RusshEndpoint,
    pub auth: RusshAuthConfig,
}

pub struct EstablishedRusshConnection {
    pub handle: client::Handle<KnownHostsHandler>,
    _jump_handle: Option<client::Handle<KnownHostsHandler>>,
}

impl client::Handler for KnownHostsHandler {
    type Error = russh::Error;

    async fn check_server_key(&mut self, key: &PublicKey) -> Result<bool, Self::Error> {
        let inspect = match known_hosts::inspect_known_host(
            &self.known_hosts_path,
            &self.host,
            self.port,
            key,
        ) {
            Ok(result) => result,
            Err(err) => {
                self.record_failure(KnownHostsConnectFailure::Error(format!(
                    "Failed to read known_hosts: {err}"
                )));
                return Ok(false);
            }
        };

        if matches!(&inspect, HostKeyCheck::Trusted) {
            return Ok(true);
        }

        let prompt = self.build_prompt(key, &inspect);
        let allow_trust = matches!(self.decision, HostKeyConnectDecision::Trust)
            && matches!(&inspect, HostKeyCheck::Unknown);
        let allow_replace = matches!(self.decision, HostKeyConnectDecision::Replace)
            && matches!(&inspect, HostKeyCheck::Mismatch { .. });

        if allow_trust || allow_replace {
            match known_hosts::trust_known_host(
                &self.known_hosts_path,
                &self.host,
                self.port,
                key,
                allow_replace,
            ) {
                Ok(()) => return Ok(true),
                Err(err) => {
                    self.record_failure(KnownHostsConnectFailure::Error(format!(
                        "Failed to update known_hosts: {err}"
                    )));
                    return Ok(false);
                }
            }
        }

        self.record_failure(KnownHostsConnectFailure::Prompt(prompt));
        Ok(false)
    }
}

impl KnownHostsHandler {
    fn record_failure(&self, failure: KnownHostsConnectFailure) {
        if let Ok(mut slot) = self.failure.lock() {
            *slot = Some(failure);
        }
    }

    fn build_prompt(&self, key: &PublicKey, inspect: &HostKeyCheck) -> HostKeyVerificationPrompt {
        let presented = known_hosts::summarize_public_key(key);
        let (reason, known_key_type, known_fingerprint_sha256) = match inspect {
            HostKeyCheck::Unknown => ("unknown", None, None),
            HostKeyCheck::Mismatch { existing } => (
                "mismatch",
                Some(existing.key_type.clone()),
                Some(existing.fingerprint_sha256.clone()),
            ),
            HostKeyCheck::Trusted => ("unknown", None, None),
        };

        HostKeyVerificationPrompt {
            reason,
            host: self.host.clone(),
            port: self.port,
            username: self.username.clone(),
            connection_id: self.connection_id.clone(),
            connection_name: self.connection_name.clone(),
            key_type: presented.key_type,
            fingerprint_sha256: presented.fingerprint_sha256,
            known_key_type,
            known_fingerprint_sha256,
        }
    }
}

#[derive(Debug, Clone)]
pub enum EstablishRusshSessionError {
    HostKeyVerificationRequired(HostKeyVerificationPrompt),
    Message(String),
}

impl std::fmt::Display for EstablishRusshSessionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::HostKeyVerificationRequired(prompt) => {
                write!(
                    f,
                    "SSH host verification required for {}:{}",
                    prompt.host, prompt.port
                )
            }
            Self::Message(message) => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for EstablishRusshSessionError {}

fn build_known_hosts_handler(
    endpoint: &RusshEndpoint,
    known_hosts_path: PathBuf,
    decision: HostKeyConnectDecision,
    failure: Arc<Mutex<Option<KnownHostsConnectFailure>>>,
) -> KnownHostsHandler {
    KnownHostsHandler {
        known_hosts_path,
        host: endpoint.host.clone(),
        port: endpoint.port,
        username: endpoint.username.clone(),
        connection_id: endpoint.connection_id.clone(),
        connection_name: endpoint.connection_name.clone(),
        decision,
        failure,
    }
}

fn map_connect_failure(
    failure: Arc<Mutex<Option<KnownHostsConnectFailure>>>,
    err: impl std::fmt::Display,
) -> EstablishRusshSessionError {
    let failure = failure.lock().ok().and_then(|mut slot| slot.take());
    match failure {
        Some(KnownHostsConnectFailure::Prompt(prompt)) => {
            EstablishRusshSessionError::HostKeyVerificationRequired(prompt)
        }
        Some(KnownHostsConnectFailure::Error(message)) => {
            EstablishRusshSessionError::Message(message)
        }
        None => EstablishRusshSessionError::Message(format!("russh connect failed: {err}")),
    }
}

pub async fn establish_russh_session_with_context(
    endpoint: &RusshEndpoint,
    known_hosts_path: PathBuf,
    decision: HostKeyConnectDecision,
) -> Result<client::Handle<KnownHostsHandler>, EstablishRusshSessionError> {
    let config = Arc::new(client::Config::default());
    let failure = Arc::new(Mutex::new(None));
    let handler = build_known_hosts_handler(endpoint, known_hosts_path, decision, failure.clone());

    match client::connect(config, (endpoint.host.as_str(), endpoint.port), handler).await {
        Ok(session) => Ok(session),
        Err(err) => Err(map_connect_failure(failure, err)),
    }
}

pub async fn establish_russh_session(
    host: &str,
    port: u16,
    known_hosts_path: PathBuf,
    decision: HostKeyConnectDecision,
) -> Result<client::Handle<KnownHostsHandler>, EstablishRusshSessionError> {
    establish_russh_session_with_context(
        &RusshEndpoint {
            host: host.to_string(),
            port,
            username: String::new(),
            connection_id: None,
            connection_name: None,
        },
        known_hosts_path,
        decision,
    )
    .await
}

pub async fn authenticate_russh_handle<H>(
    handle: &mut client::Handle<H>,
    username: &str,
    auth: &RusshAuthConfig,
) -> Result<(), String>
where
    H: client::Handler + Send + 'static,
{
    let auth_result = if let Some(pk) = auth.private_key.as_deref() {
        let key_pair = russh::keys::decode_secret_key(pk, auth.passphrase.as_deref())
            .map_err(|e| format_private_key_parse_error(e, auth.passphrase.is_some()))?;
        handle
            .authenticate_publickey(
                username,
                PrivateKeyWithHashAlg::new(
                    Arc::new(key_pair),
                    handle
                        .best_supported_rsa_hash()
                        .await
                        .map_err(|e| e.to_string())?
                        .flatten(),
                ),
            )
            .await
            .map_err(|e| format!("Authentication failed: {e}"))?
    } else if let Some(password) = auth.password.as_deref() {
        handle
            .authenticate_password(username, password)
            .await
            .map_err(|e| format!("Authentication failed: {e}"))?
    } else {
        return Err("Missing authentication method.".to_string());
    };

    if auth_result.success() {
        Ok(())
    } else {
        Err("Authentication failed.".to_string())
    }
}

pub async fn establish_russh_session_via_jump(
    target: &RusshEndpoint,
    known_hosts_path: PathBuf,
    target_decision: HostKeyConnectDecision,
    jump: &RusshJumpHostConfig,
    jump_decision: HostKeyConnectDecision,
) -> Result<EstablishedRusshConnection, EstablishRusshSessionError> {
    let mut jump_handle = establish_russh_session_with_context(
        &jump.endpoint,
        known_hosts_path.clone(),
        jump_decision,
    )
    .await?;

    authenticate_russh_handle(&mut jump_handle, &jump.endpoint.username, &jump.auth)
        .await
        .map_err(EstablishRusshSessionError::Message)?;

    let stream = jump_handle
        .channel_open_direct_tcpip(&target.host, target.port as u32, "127.0.0.1", 0)
        .await
        .map_err(|e| {
            EstablishRusshSessionError::Message(format!("Failed to open jump tunnel: {e}"))
        })?
        .into_stream();

    let config = Arc::new(client::Config::default());
    let failure = Arc::new(Mutex::new(None));
    let handler =
        build_known_hosts_handler(target, known_hosts_path, target_decision, failure.clone());

    let handle = match client::connect_stream(config, stream, handler).await {
        Ok(session) => session,
        Err(err) => return Err(map_connect_failure(failure, err)),
    };

    Ok(EstablishedRusshConnection {
        handle,
        _jump_handle: Some(jump_handle),
    })
}

pub fn parse_json_value(raw: &str, fallback: Value) -> Value {
    serde_json::from_str(raw).unwrap_or(fallback)
}

pub fn value_to_json_string(value: &Value, fallback: &str) -> String {
    match value {
        Value::Null => fallback.to_string(),
        Value::String(s) => s.clone(),
        _ => serde_json::to_string(value).unwrap_or_else(|_| fallback.to_string()),
    }
}

pub fn string_or_default(value: String, fallback: &str) -> String {
    if value.trim().is_empty() {
        fallback.to_string()
    } else {
        value
    }
}

pub fn format_private_key_parse_error<E>(error: E, passphrase_supplied: bool) -> String
where
    E: std::fmt::Display,
{
    let raw = error.to_string();
    let normalized = raw.to_ascii_lowercase();
    if !passphrase_supplied
        && (normalized.contains("the key is encrypted") || normalized.contains("key is encrypted"))
    {
        "Private key is encrypted. Please provide the passphrase.".to_string()
    } else {
        format!("Private key parse failed: {raw}")
    }
}

pub fn to_connection_public(row: ConnectionRow) -> ConnectionPublic {
    ConnectionPublic {
        id: row.id,
        folder_id: row.folder_id,
        name: row.name,
        protocol: row.protocol,
        host: row.host,
        port: row.port,
        username: row.username,
        auth_method: row.auth_method,
        has_password: !row.encrypted_password.as_deref().unwrap_or("").is_empty(),
        has_private_key: !row
            .encrypted_private_key
            .as_deref()
            .unwrap_or("")
            .is_empty(),
        sort_order: row.sort_order,
        remark: row.remark,
        color_tag: row.color_tag,
        environment: if row.environment.is_empty() {
            "无".to_string()
        } else {
            row.environment
        },
        auth_type: if row.auth_type.is_empty() {
            "password".to_string()
        } else {
            row.auth_type
        },
        proxy_type: if row.proxy_type.is_empty() {
            "关闭".to_string()
        } else {
            row.proxy_type
        },
        proxy_host: if row.proxy_host.is_empty() {
            "127.0.0.1".to_string()
        } else {
            row.proxy_host
        },
        proxy_port: if row.proxy_port <= 0 {
            7890
        } else {
            row.proxy_port
        },
        proxy_username: row.proxy_username,
        proxy_timeout: if row.proxy_timeout <= 0 {
            5
        } else {
            row.proxy_timeout
        },
        jump_server_id: row.jump_server_id,
        preset_id: row.preset_id,
        private_key_id: row.private_key_id,
        jump_key_id: row.jump_key_id,
        has_passphrase: !row.encrypted_passphrase.as_deref().unwrap_or("").is_empty(),
        tunnels: parse_json_value(&row.tunnels, Value::Array(vec![])),
        env_vars: parse_json_value(&row.env_vars, Value::Array(vec![])),
        advanced: parse_json_value(&row.advanced, Value::Object(serde_json::Map::new())),
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

pub async fn mark_local_dirty(db: &Db) -> Result<(), ApiError> {
    sqlx::query("UPDATE sync_state SET local_dirty = 1 WHERE id = 1")
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(())
}

pub async fn insert_connection(db: &Db, row: &ConnectionRow) -> Result<(), ApiError> {
    sqlx::query("INSERT INTO connections (id, folder_id, name, protocol, host, port, username, auth_method, encrypted_password, encrypted_private_key, sort_order, remark, color_tag, environment, auth_type, proxy_type, proxy_host, proxy_port, proxy_username, proxy_password, proxy_timeout, jump_server_id, preset_id, private_key_id, jump_key_id, encrypted_passphrase, tunnels, env_vars, advanced, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&row.id).bind(&row.folder_id).bind(&row.name).bind(&row.protocol)
        .bind(&row.host).bind(row.port).bind(&row.username).bind(&row.auth_method)
        .bind(&row.encrypted_password).bind(&row.encrypted_private_key)
        .bind(row.sort_order).bind(&row.remark).bind(&row.color_tag)
        .bind(&row.environment).bind(&row.auth_type).bind(&row.proxy_type)
        .bind(&row.proxy_host).bind(row.proxy_port).bind(&row.proxy_username)
        .bind(&row.proxy_password).bind(row.proxy_timeout).bind(&row.jump_server_id)
        .bind(&row.preset_id).bind(&row.private_key_id).bind(&row.jump_key_id)
        .bind(&row.encrypted_passphrase).bind(&row.tunnels).bind(&row.env_vars)
        .bind(&row.advanced).bind(&row.created_at).bind(&row.updated_at)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(())
}

pub async fn update_connection_row(db: &Db, row: &ConnectionRow) -> Result<(), ApiError> {
    sqlx::query("UPDATE connections SET folder_id = ?, name = ?, protocol = ?, host = ?, port = ?, username = ?, auth_method = ?, encrypted_password = ?, encrypted_private_key = ?, sort_order = ?, remark = ?, color_tag = ?, environment = ?, auth_type = ?, proxy_type = ?, proxy_host = ?, proxy_port = ?, proxy_username = ?, proxy_password = ?, proxy_timeout = ?, jump_server_id = ?, preset_id = ?, private_key_id = ?, jump_key_id = ?, encrypted_passphrase = ?, tunnels = ?, env_vars = ?, advanced = ?, updated_at = ? WHERE id = ?")
        .bind(&row.folder_id).bind(&row.name).bind(&row.protocol).bind(&row.host)
        .bind(row.port).bind(&row.username).bind(&row.auth_method)
        .bind(&row.encrypted_password).bind(&row.encrypted_private_key)
        .bind(row.sort_order).bind(&row.remark).bind(&row.color_tag)
        .bind(&row.environment).bind(&row.auth_type).bind(&row.proxy_type)
        .bind(&row.proxy_host).bind(row.proxy_port).bind(&row.proxy_username)
        .bind(&row.proxy_password).bind(row.proxy_timeout).bind(&row.jump_server_id)
        .bind(&row.preset_id).bind(&row.private_key_id).bind(&row.jump_key_id)
        .bind(&row.encrypted_passphrase).bind(&row.tunnels).bind(&row.env_vars)
        .bind(&row.advanced).bind(&row.updated_at).bind(&row.id)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(())
}
