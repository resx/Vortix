use serde_json::{Value, json};
use std::path::PathBuf;
use tokio::sync::mpsc as tokio_mpsc;

use crate::server::helpers::{
    EstablishRusshSessionError, HostKeyConnectDecision, RusshAuthConfig, RusshEndpoint,
    RusshJumpHostConfig, authenticate_russh_handle, establish_russh_session_via_jump,
    establish_russh_session_with_context,
};

use super::connection_flow::{
    detect_remote_login_shell, emit_connection_stage, emit_hostkey_prompt, endpoint_matches_prompt,
    is_bash_shell, wait_for_hostkey_decision,
};
use super::runtime_loop::ssh_main_loop;
use super::shell_integration::{bash_shell_integration_script, emit_shell_integration_status};
use super::{HostKeyDecision, SshReq};

#[allow(clippy::too_many_arguments)]
pub(super) async fn ssh_worker_task(
    host: String,
    port: u16,
    username: String,
    password: Option<String>,
    private_key: Option<String>,
    passphrase: Option<String>,
    connection_id: Option<String>,
    connection_name: Option<String>,
    terminal_enhance: bool,
    jump: Option<RusshJumpHostConfig>,
    known_hosts_path: PathBuf,
    cols: u32,
    rows: u32,
    rx: tokio_mpsc::UnboundedReceiver<SshReq>,
    mut hostkey_rx: tokio_mpsc::UnboundedReceiver<HostKeyDecision>,
    event_tx: tokio::sync::mpsc::UnboundedSender<Value>,
) -> Result<(), String> {
    let hop_count = if jump.is_some() { 2 } else { 1 };
    let endpoint = RusshEndpoint {
        host: host.clone(),
        port,
        username: username.clone(),
        connection_id: connection_id.clone(),
        connection_name: connection_name.clone(),
    };
    let auth = RusshAuthConfig {
        password,
        private_key,
        passphrase,
    };

    let mut target_decision = HostKeyConnectDecision::Reject;
    let mut jump_decision = HostKeyConnectDecision::Reject;
    let mut handle = loop {
        if let Some(jump_config) = jump.as_ref() {
            emit_connection_stage(
                &event_tx,
                &jump_config.endpoint,
                "jump",
                "connecting",
                1,
                hop_count,
            );
        } else {
            emit_connection_stage(&event_tx, &endpoint, "target", "connecting", 1, hop_count);
        }

        let connect_result = if let Some(jump_config) = jump.as_ref() {
            establish_russh_session_via_jump(
                &endpoint,
                known_hosts_path.clone(),
                target_decision,
                jump_config,
                jump_decision,
            )
            .await
            .map(|session| session.handle)
        } else {
            establish_russh_session_with_context(
                &endpoint,
                known_hosts_path.clone(),
                target_decision,
            )
            .await
        };

        match connect_result {
            Ok(session) => {
                if let Some(jump_config) = jump.as_ref() {
                    emit_connection_stage(
                        &event_tx,
                        &jump_config.endpoint,
                        "jump",
                        "connected",
                        1,
                        hop_count,
                    );
                    emit_connection_stage(
                        &event_tx,
                        &endpoint,
                        "target",
                        "connecting",
                        2,
                        hop_count,
                    );
                }
                break session;
            }
            Err(EstablishRusshSessionError::HostKeyVerificationRequired(prompt)) => {
                let (role, hop_index) = if let Some(jump_config) = jump.as_ref() {
                    if endpoint_matches_prompt(&jump_config.endpoint, &prompt) {
                        ("jump", 1)
                    } else {
                        ("target", 2)
                    }
                } else {
                    ("target", 1)
                };
                let request_id = format!("ssh-hostkey-{}-{}", prompt.host, prompt.port);
                emit_connection_stage(
                    &event_tx,
                    &RusshEndpoint {
                        host: prompt.host.clone(),
                        port: prompt.port,
                        username: prompt.username.clone(),
                        connection_id: prompt.connection_id.clone(),
                        connection_name: prompt.connection_name.clone(),
                    },
                    role,
                    "awaiting-hostkey-decision",
                    hop_index,
                    hop_count,
                );
                emit_hostkey_prompt(&event_tx, &prompt, &request_id, role, hop_index, hop_count);

                let Some(decision) = wait_for_hostkey_decision(&mut hostkey_rx, &request_id).await
                else {
                    return Err("SSH host identity verification was interrupted.".to_string());
                };
                if !decision.trust {
                    return Err("SSH server identity was not trusted. Connection cancelled.".to_string());
                }

                let next_decision = if decision.replace_existing {
                    HostKeyConnectDecision::Replace
                } else {
                    HostKeyConnectDecision::Trust
                };
                if let Some(jump_config) = jump.as_ref() {
                    if endpoint_matches_prompt(&jump_config.endpoint, &prompt) {
                        jump_decision = next_decision;
                        emit_connection_stage(
                            &event_tx,
                            &jump_config.endpoint,
                            "jump",
                            "connecting",
                            1,
                            hop_count,
                        );
                    } else {
                        target_decision = next_decision;
                        emit_connection_stage(
                            &event_tx,
                            &endpoint,
                            "target",
                            "connecting",
                            2,
                            hop_count,
                        );
                    }
                } else {
                    target_decision = next_decision;
                    emit_connection_stage(&event_tx, &endpoint, "target", "connecting", 1, hop_count);
                }
            }
            Err(EstablishRusshSessionError::Message(message)) => return Err(message),
        }
    };

    tracing::info!("SSH session established ({}), authenticating {}", host, username);
    emit_connection_stage(&event_tx, &endpoint, "target", "authenticating", hop_count, hop_count);
    authenticate_russh_handle(&mut handle, &username, &auth).await?;
    emit_connection_stage(&event_tx, &endpoint, "target", "connected", hop_count, hop_count);
    tracing::info!("SSH authentication succeeded ({})", host);

    let enable_shell_integration = terminal_enhance
        && detect_remote_login_shell(&handle)
            .await
            .as_deref()
            .map(is_bash_shell)
            .unwrap_or(false);

    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open session channel: {e}"))?;
    channel
        .request_pty(false, "xterm-256color", cols, rows, 0, 0, &[])
        .await
        .map_err(|e| format!("Failed to request PTY: {e}"))?;
    channel
        .request_shell(false)
        .await
        .map_err(|e| format!("Failed to start shell: {e}"))?;
    if enable_shell_integration {
        channel
            .data(bash_shell_integration_script().as_bytes())
            .await
            .map_err(|e| format!("Failed to initialize shell integration: {e}"))?;
    } else if terminal_enhance {
        emit_shell_integration_status(&event_tx, "unsupported");
    }

    let _ = event_tx.send(json!({ "type": "status", "data": "connected" }));
    ssh_main_loop(&handle, &mut channel, rx, &event_tx).await;
    let _ = event_tx.send(json!({ "type": "status", "data": "closed" }));
    Ok(())
}
