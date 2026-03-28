use serde_json::{Value, json};
use tokio::sync::mpsc as tokio_mpsc;

use crate::server::helpers::HostKeyVerificationPrompt;

use super::HostKeyDecision;

pub(super) fn emit_hostkey_prompt(
    event_tx: &tokio_mpsc::UnboundedSender<Value>,
    prompt: &HostKeyVerificationPrompt,
    request_id: &str,
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
    hostkey_rx: &mut tokio_mpsc::UnboundedReceiver<HostKeyDecision>,
    request_id: &str,
) -> Option<HostKeyDecision> {
    while let Some(decision) = hostkey_rx.recv().await {
        if decision.request_id == request_id {
            return Some(decision);
        }
    }
    None
}

pub(super) fn send_worker_ok(
    event_tx: &tokio_mpsc::UnboundedSender<Value>,
    typ: &str,
    data: Value,
    request_id: Option<String>,
) {
    let mut payload = json!({ "type": typ, "data": data });
    if let Some(rid) = request_id {
        payload["requestId"] = Value::String(rid);
    }
    let _ = event_tx.send(payload);
}

pub(super) fn send_worker_error(
    event_tx: &tokio_mpsc::UnboundedSender<Value>,
    typ: &str,
    message: String,
    request_id: Option<String>,
) {
    let mut payload = json!({ "type": typ, "data": { "message": message } });
    if let Some(rid) = request_id {
        payload["requestId"] = Value::String(rid);
    }
    let _ = event_tx.send(payload);
}
