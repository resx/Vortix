use russh::client;
use serde_json::{Value, json};
use tokio::sync::mpsc as tokio_mpsc;

use crate::server::helpers::{HostKeyVerificationPrompt, RusshAuthConfig, RusshEndpoint, RusshJumpHostConfig};

use super::HostKeyDecision;

pub(super) fn emit_connection_stage(
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
    endpoint: &RusshEndpoint,
    role: &'static str,
    phase: &'static str,
    hop_index: u8,
    hop_count: u8,
) {
    let _ = event_tx.send(json!({
        "type": "connection-stage",
        "data": {
            "role": role,
            "phase": phase,
            "host": endpoint.host,
            "port": endpoint.port,
            "username": endpoint.username,
            "connectionId": endpoint.connection_id,
            "connectionName": endpoint.connection_name,
            "hopIndex": hop_index,
            "hopCount": hop_count,
        }
    }));
}

pub(super) fn emit_hostkey_prompt(
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
    prompt: &HostKeyVerificationPrompt,
    request_id: &str,
    role: &'static str,
    hop_index: u8,
    hop_count: u8,
) {
    let mut payload = json!({
        "requestId": request_id,
        "reason": prompt.reason,
        "host": prompt.host,
        "port": prompt.port,
        "username": prompt.username,
        "connectionId": prompt.connection_id,
        "connectionName": prompt.connection_name,
        "keyType": prompt.key_type,
        "fingerprintSha256": prompt.fingerprint_sha256,
        "hostRole": role,
        "hopIndex": hop_index,
        "hopCount": hop_count,
    });

    if let Some(known_key_type) = &prompt.known_key_type {
        payload["knownKeyType"] = Value::String(known_key_type.clone());
    }
    if let Some(known_fingerprint) = &prompt.known_fingerprint_sha256 {
        payload["knownFingerprintSha256"] = Value::String(known_fingerprint.clone());
    }

    let _ = event_tx.send(json!({
        "type": "hostkey-verification-required",
        "data": payload,
    }));
}

pub(super) async fn wait_for_hostkey_decision(
    rx: &mut tokio_mpsc::UnboundedReceiver<HostKeyDecision>,
    request_id: &str,
) -> Option<HostKeyDecision> {
    while let Some(decision) = rx.recv().await {
        if decision.request_id == request_id {
            return Some(decision);
        }
    }
    None
}

pub(super) fn endpoint_matches_prompt(
    endpoint: &RusshEndpoint,
    prompt: &HostKeyVerificationPrompt,
) -> bool {
    endpoint.host == prompt.host
        && endpoint.port == prompt.port
        && endpoint.username == prompt.username
        && endpoint.connection_id == prompt.connection_id
}

pub(super) fn parse_jump_config(connect: &Value) -> Result<Option<RusshJumpHostConfig>, String> {
    let Some(jump) = connect.get("jump") else {
        return Ok(None);
    };
    let Some(jump) = jump.as_object() else {
        return Err("Invalid jump configuration".to_string());
    };

    let host = jump
        .get("host")
        .and_then(|v| v.as_str())
        .ok_or("Missing jump host")?
        .to_string();
    let username = jump
        .get("username")
        .and_then(|v| v.as_str())
        .ok_or("Missing jump username")?
        .to_string();
    let port = jump.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;

    Ok(Some(RusshJumpHostConfig {
        endpoint: RusshEndpoint {
            host,
            port,
            username,
            connection_id: jump
                .get("connectionId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            connection_name: jump
                .get("connectionName")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        },
        auth: RusshAuthConfig {
            password: jump
                .get("password")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            private_key: jump
                .get("privateKey")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            passphrase: jump
                .get("passphrase")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        },
    }))
}

pub(super) async fn detect_remote_login_shell(
    handle: &client::Handle<crate::server::helpers::KnownHostsHandler>,
) -> Option<String> {
    super::russh_exec(handle, r#"printf '%s' "${SHELL:-}" "#)
        .await
        .ok()
        .map(|shell| shell.trim().to_string())
        .filter(|shell| !shell.is_empty())
}

pub(super) fn is_bash_shell(shell: &str) -> bool {
    let lower = shell
        .trim()
        .rsplit('/')
        .next()
        .unwrap_or(shell)
        .to_ascii_lowercase();
    lower == "bash"
}
