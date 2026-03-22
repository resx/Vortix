/* SSH terminal worker (russh) */

use crate::server::helpers::{
    EstablishRusshSessionError, HostKeyConnectDecision, HostKeyVerificationPrompt,
    KnownHostsHandler, RusshAuthConfig, RusshEndpoint, RusshJumpHostConfig,
    authenticate_russh_handle, establish_russh_session_via_jump,
    establish_russh_session_with_context,
};
use russh::{ChannelMsg, client};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tokio::sync::mpsc as tokio_mpsc;

#[derive(Clone)]
pub struct SshWorker {
    pub tx: tokio_mpsc::UnboundedSender<SshReq>,
    pub hostkey_tx: tokio_mpsc::UnboundedSender<HostKeyDecision>,
}

#[derive(Debug)]
pub enum SshReq {
    Input(String),
    Resize { cols: u32, rows: u32 },
    Pwd { request_id: Option<String> },
    MonitorStart,
    MonitorStop,
    Disconnect,
}

#[derive(Debug, Clone)]
pub struct HostKeyDecision {
    pub request_id: String,
    pub trust: bool,
    pub replace_existing: bool,
}

fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

fn emit_connection_stage(
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

fn emit_hostkey_prompt(
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

async fn wait_for_hostkey_decision(
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

fn endpoint_matches_prompt(endpoint: &RusshEndpoint, prompt: &HostKeyVerificationPrompt) -> bool {
    endpoint.host == prompt.host
        && endpoint.port == prompt.port
        && endpoint.username == prompt.username
        && endpoint.connection_id == prompt.connection_id
}

fn parse_jump_config(connect: &Value) -> Result<Option<RusshJumpHostConfig>, String> {
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

async fn russh_exec(
    handle: &client::Handle<KnownHostsHandler>,
    cmd: &str,
) -> Result<String, String> {
    let mut ch = handle
        .channel_open_session()
        .await
        .map_err(|e| e.to_string())?;
    ch.exec(true, cmd).await.map_err(|e| e.to_string())?;
    let mut stdout = String::new();
    while let Some(msg) = ch.wait().await {
        match msg {
            ChannelMsg::Data { data } => stdout.push_str(&String::from_utf8_lossy(&data)),
            ChannelMsg::Eof | ChannelMsg::Close => break,
            _ => {}
        }
    }
    Ok(stdout)
}

const SHELL_INTEGRATION_OSC_PREFIX: &str = "\u{1b}]633;";
const SHELL_INTEGRATION_OSC_ST: &str = "\u{1b}\\";

#[derive(Default)]
struct ShellIntegrationState {
    buffer: String,
    current_cwd: Option<String>,
    pending_command: Option<String>,
    ready_emitted: bool,
}

fn bash_shell_integration_script() -> &'static str {
    r#"if [ -n "${BASH_VERSION-}" ]; then
eval "$(cat <<'__VORTIX_BASH__'
if [ -z "${__vortix_shell_integration_ready-}" ]; then
__vortix_shell_integration_ready=1
__vortix_last_history_id=
__vortix_current_command=
__vortix_in_precmd=0

__vortix_escape_value_fast() {
  local LC_ALL=C out
  out=${1//\\/\\\\}
  out=${out//;/\\x3b}
  printf '%s' "$out"
}

__vortix_escape_value() {
  if [ "${#1}" -ge 2000 ]; then
    __vortix_escape_value_fast "$1"
    return 0
  fi
  local -r LC_ALL=C
  local -r str="${1}"
  local -ir len="${#str}"
  local -i i
  local -i val
  local byte token out=''
  for (( i=0; i < len; ++i )); do
    byte="${str:$i:1}"
    printf -v val '%d' "'$byte"
    if (( val < 32 )); then
      printf -v token '\\x%02x' "$val"
    elif (( val == 92 )); then
      token="\\\\"
    elif (( val == 59 )); then
      token="\\x3b"
    else
      token="$byte"
    fi
    out+="$token"
  done
  printf '%s' "$out"
}

__vortix_emit_osc() {
  printf '\033]633;%s\a' "$1"
}

__vortix_read_history_entry() {
  local entry
  entry="$(builtin history 1 2>/dev/null)" || return 1
  [[ "$entry" =~ ^[[:space:]]*([0-9]+)[[:space:]]+(.*)$ ]] || return 1
  printf '%s\t%s' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
}

__vortix_update_history_id() {
  local entry
  entry="$(__vortix_read_history_entry)" || return 0
  __vortix_last_history_id="${entry%%$'\t'*}"
}

__vortix_preexec() {
  [[ "${__vortix_in_precmd:-0}" -eq 1 ]] && return
  local entry history_id cmd
  entry="$(__vortix_read_history_entry)" || return
  history_id="${entry%%$'\t'*}"
  cmd="${entry#*$'\t'}"
  if [[ -z "$history_id" || "$history_id" == "${__vortix_last_history_id-}" ]]; then
    return
  fi
  __vortix_last_history_id="$history_id"
  if [[ -z "$cmd" || "$cmd" == *"__vortix_"* ]]; then
    __vortix_current_command=
    return
  fi
  __vortix_current_command="$cmd"
  __vortix_emit_osc "E;$(__vortix_escape_value "$cmd")"
}

__vortix_precmd() {
  local ec=$?
  __vortix_in_precmd=1
  builtin history -a 2>/dev/null
  if [[ -z "${__vortix_ready_sent-}" ]]; then
    __vortix_emit_osc "P;VortixShell=Ready"
    __vortix_ready_sent=1
  fi
  __vortix_emit_osc "P;Cwd=$(__vortix_escape_value "$PWD")"
  if [[ -n "${__vortix_current_command-}" ]]; then
    __vortix_emit_osc "D;$ec"
  else
    __vortix_emit_osc "D"
  fi
  __vortix_current_command=
  __vortix_update_history_id
  __vortix_in_precmd=0
  return "$ec"
}

case "${PS0-}" in
  *'$(__vortix_preexec)'*) ;;
  *) PS0='$(__vortix_preexec)'"${PS0-}" ;;
esac

case "$(declare -p PROMPT_COMMAND 2>/dev/null)" in
  "declare -a"*)
    __vortix_has_precmd=0
    for __vortix_prompt_cmd in "${PROMPT_COMMAND[@]}"; do
      if [[ "$__vortix_prompt_cmd" == "__vortix_precmd" ]]; then
        __vortix_has_precmd=1
        break
      fi
    done
    if [[ "$__vortix_has_precmd" -eq 0 ]]; then
      PROMPT_COMMAND=(__vortix_precmd "${PROMPT_COMMAND[@]}")
    fi
    unset __vortix_has_precmd __vortix_prompt_cmd
    ;;
  *)
    case ";${PROMPT_COMMAND-};" in
      *";__vortix_precmd;"*) ;;
      *)
        if [ -n "${PROMPT_COMMAND-}" ]; then
          PROMPT_COMMAND="__vortix_precmd;$PROMPT_COMMAND"
        else
          PROMPT_COMMAND="__vortix_precmd"
        fi
        ;;
    esac
    ;;
esac

__vortix_update_history_id
fi
__VORTIX_BASH__
)"
fi
"#
}

fn drain_all_but_tail_chars(buffer: &mut String, tail_chars: usize) -> Option<String> {
    let char_count = buffer.chars().count();
    if char_count <= tail_chars {
        return None;
    }
    let split_at = buffer
        .char_indices()
        .nth(char_count - tail_chars)
        .map(|(idx, _)| idx)
        .unwrap_or(buffer.len());
    let text = buffer[..split_at].to_string();
    buffer.drain(..split_at);
    Some(text)
}

fn shell_integration_partial_tail_chars(buffer: &str) -> usize {
    let chars = buffer.chars().collect::<Vec<_>>();
    let max = chars
        .len()
        .min(SHELL_INTEGRATION_OSC_PREFIX.len().saturating_sub(1));
    for len in (1..=max).rev() {
        let suffix: String = chars[chars.len() - len..].iter().collect();
        if SHELL_INTEGRATION_OSC_PREFIX.starts_with(&suffix) {
            return len;
        }
    }
    0
}

fn emit_shell_integration_status(
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
    status: &'static str,
) {
    let _ = event_tx.send(json!({
        "type": "shell-integration-status",
        "data": { "status": status }
    }));
}

fn emit_shell_command_finished(
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
    command: &str,
    cwd: Option<&str>,
    exit_code: Option<i32>,
) {
    let command = command.trim();
    if command.is_empty() || command.contains("__vortix_") {
        return;
    }
    let _ = event_tx.send(json!({
        "type": "shell-command-finished",
        "data": {
            "command": command,
            "cwd": cwd.unwrap_or(""),
            "exitCode": exit_code,
        },
    }));
}

fn find_shell_integration_osc_terminator(buffer: &str) -> Option<(usize, usize)> {
    for (idx, ch) in buffer.char_indices() {
        if ch == '\u{7}' {
            return Some((idx, 1));
        }
        if ch == '\u{1b}' && buffer[idx..].starts_with(SHELL_INTEGRATION_OSC_ST) {
            return Some((idx, SHELL_INTEGRATION_OSC_ST.len()));
        }
    }
    None
}

fn decode_shell_integration_value(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'\\' {
            if i + 1 < bytes.len() && bytes[i + 1] == b'\\' {
                out.push(b'\\');
                i += 2;
                continue;
            }
            if i + 3 < bytes.len()
                && bytes[i + 1] == b'x'
                && bytes[i + 2].is_ascii_hexdigit()
                && bytes[i + 3].is_ascii_hexdigit()
            {
                let hex = &value[i + 2..i + 4];
                if let Ok(byte) = u8::from_str_radix(hex, 16) {
                    out.push(byte);
                    i += 4;
                    continue;
                }
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn handle_shell_integration_sequence(
    state: &mut ShellIntegrationState,
    payload: &str,
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
) {
    if let Some(rest) = payload.strip_prefix("P;") {
        let Some((key, raw_value)) = rest.split_once('=') else {
            return;
        };
        let value = decode_shell_integration_value(raw_value);
        match key {
            "VortixShell" if value == "Ready" => {
                if !state.ready_emitted {
                    state.ready_emitted = true;
                    emit_shell_integration_status(event_tx, "ready");
                }
            }
            "Cwd" => {
                state.current_cwd = Some(value);
            }
            _ => {}
        }
        return;
    }

    if let Some(raw_command) = payload.strip_prefix("E;") {
        state.pending_command = Some(decode_shell_integration_value(raw_command));
        return;
    }

    if payload == "D" || payload.starts_with("D;") {
        let exit_code = payload
            .strip_prefix("D;")
            .and_then(|raw| raw.trim().parse::<i32>().ok());
        if let Some(command) = state.pending_command.take() {
            emit_shell_command_finished(
                event_tx,
                &command,
                state.current_cwd.as_deref(),
                exit_code,
            );
        }
    }
}

fn process_shell_integration_output(
    state: &mut ShellIntegrationState,
    text: &str,
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
) -> Option<String> {
    state.buffer.push_str(text);

    let mut passthrough = String::new();
    loop {
        if let Some(start_idx) = state.buffer.find(SHELL_INTEGRATION_OSC_PREFIX) {
            if start_idx > 0 {
                passthrough.push_str(&state.buffer[..start_idx]);
                state.buffer.drain(..start_idx);
            }
            let payload_offset = SHELL_INTEGRATION_OSC_PREFIX.len();
            let Some((end_rel_idx, terminator_len)) =
                find_shell_integration_osc_terminator(&state.buffer[payload_offset..])
            else {
                break;
            };
            let payload_end = payload_offset + end_rel_idx;
            let payload = state.buffer[payload_offset..payload_end].to_string();
            state.buffer.drain(..payload_end + terminator_len);
            handle_shell_integration_sequence(state, &payload, event_tx);
            continue;
        }

        let keep = shell_integration_partial_tail_chars(&state.buffer);
        if let Some(text) = drain_all_but_tail_chars(&mut state.buffer, keep) {
            passthrough.push_str(&text);
        }
        break;
    }

    if passthrough.is_empty() {
        None
    } else {
        Some(passthrough)
    }
}
async fn detect_remote_login_shell(handle: &client::Handle<KnownHostsHandler>) -> Option<String> {
    russh_exec(handle, r#"printf '%s' "${SHELL:-}" "#)
        .await
        .ok()
        .map(|shell| shell.trim().to_string())
        .filter(|shell| !shell.is_empty())
}

fn is_bash_shell(shell: &str) -> bool {
    let lower = shell.trim().rsplit('/').next().unwrap_or(shell).to_ascii_lowercase();
    lower == "bash"
}

pub fn start_ssh_worker(
    connect: Value,
    event_tx: tokio::sync::mpsc::UnboundedSender<Value>,
    known_hosts_path: PathBuf,
) -> Result<SshWorker, String> {
    let host = connect
        .get("host")
        .and_then(|v| v.as_str())
        .ok_or("Missing host")?
        .to_string();
    let username = connect
        .get("username")
        .and_then(|v| v.as_str())
        .ok_or("Missing username")?
        .to_string();
    let port = connect.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let password = connect
        .get("password")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let private_key = connect
        .get("privateKey")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let passphrase = connect
        .get("passphrase")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let connection_id = connect
        .get("connectionId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let connection_name = connect
        .get("connectionName")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let terminal_enhance = connect
        .get("terminalEnhance")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let jump = parse_jump_config(&connect)?;
    let cols = connect
        .get("cols")
        .and_then(|v| v.as_u64())
        .unwrap_or(120)
        .clamp(1, 500) as u32;
    let rows = connect
        .get("rows")
        .and_then(|v| v.as_u64())
        .unwrap_or(30)
        .clamp(1, 200) as u32;

    let (tx, rx) = tokio_mpsc::unbounded_channel::<SshReq>();
    let (hostkey_tx, hostkey_rx) = tokio_mpsc::unbounded_channel::<HostKeyDecision>();

    tokio::spawn(async move {
        if let Err(e) = ssh_worker_task(
            host,
            port,
            username,
            password,
            private_key,
            passphrase,
            connection_id,
            connection_name,
            terminal_enhance,
            jump,
            known_hosts_path,
            cols,
            rows,
            rx,
            hostkey_rx,
            event_tx.clone(),
        )
        .await
        {
            let _ = event_tx.send(json!({ "type": "error", "data": e }));
        }
    });

    Ok(SshWorker { tx, hostkey_tx })
}

#[allow(clippy::too_many_arguments)]
async fn ssh_worker_task(
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
                    return Err(
                        "SSH server identity was not trusted. Connection cancelled.".to_string()
                    );
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
                    emit_connection_stage(
                        &event_tx,
                        &endpoint,
                        "target",
                        "connecting",
                        1,
                        hop_count,
                    );
                }
            }
            Err(EstablishRusshSessionError::Message(message)) => {
                return Err(message);
            }
        }
    };

    tracing::info!(
        "SSH session established ({}), authenticating {}",
        host,
        username
    );
    emit_connection_stage(
        &event_tx,
        &endpoint,
        "target",
        "authenticating",
        hop_count,
        hop_count,
    );
    authenticate_russh_handle(&mut handle, &username, &auth).await?;
    emit_connection_stage(
        &event_tx,
        &endpoint,
        "target",
        "connected",
        hop_count,
        hop_count,
    );
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

async fn ssh_main_loop(
    handle: &client::Handle<KnownHostsHandler>,
    channel: &mut russh::Channel<client::Msg>,
    mut rx: tokio_mpsc::UnboundedReceiver<SshReq>,
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
) {
    let mut pwd_request_id: Option<String> = None;
    let mut pwd_buffer = String::new();
    let mut suppress_until: Option<Instant> = None;
    let mut shell_integration = ShellIntegrationState {
        buffer: String::new(),
        current_cwd: None,
        pending_command: None,
        ready_emitted: false,
    };

    let mut monitor_enabled = false;
    let mut monitor_interval = tokio::time::interval(Duration::from_secs(3));
    let mut prev_cpu_sample: Option<Vec<u64>> = None;
    let mut prev_per_core_samples: Option<Vec<Vec<u64>>> = None;
    let mut prev_net_sample: Option<HashMap<String, (u64, u64)>> = None;
    let mut prev_sample_time: Option<Instant> = None;
    let mut cpu_core_count: u32 = 1;

    loop {
        tokio::select! {
            Some(req) = rx.recv() => {
                match req {
                    SshReq::Input(data) => { let _ = channel.data(data.as_bytes()).await; }
                    SshReq::Resize { cols, rows } => { let _ = channel.window_change(cols, rows, 0, 0).await; }
                    SshReq::Pwd { request_id } => {
                        pwd_request_id = request_id;
                        pwd_buffer.clear();
                        let _ = channel.data(&b" printf '\\x5f\\x5fVORTIX_PWD_START\\x5f\\x5f%s\\x5f\\x5fVORTIX_PWD_END\\x5f\\x5f\\n' \"$(pwd)\"\n"[..]).await;
                    }
                    SshReq::MonitorStart => {
                        monitor_enabled = true;
                        prev_cpu_sample = None;
                        prev_per_core_samples = None;
                        prev_net_sample = None;
                        prev_sample_time = None;
                        monitor_interval.reset();
                        handle_monitor_init(handle, event_tx, &mut cpu_core_count).await;
                    }
                    SshReq::MonitorStop => {
                        monitor_enabled = false;
                        prev_cpu_sample = None;
                        prev_per_core_samples = None;
                        prev_net_sample = None;
                        prev_sample_time = None;
                    }
                    SshReq::Disconnect => { let _ = channel.close().await; break; }
                }
            }
            Some(msg) = channel.wait() => {
                match msg {
                    ChannelMsg::Data { data } => {
                        let text = String::from_utf8_lossy(&data).to_string();
                        if let Some(req_id) = pwd_request_id.clone() {
                            pwd_buffer.push_str(&text);
                            let start = pwd_buffer.find("__VORTIX_PWD_START__");
                            let end = pwd_buffer.find("__VORTIX_PWD_END__");
                            if let (Some(s), Some(e)) = (start, end) {
                                if e > s {
                                    let path = pwd_buffer[s + "__VORTIX_PWD_START__".len()..e].trim().to_string();
                                    let _ = event_tx.send(json!({
                                        "type": "pwd-result",
                                        "data": { "requestId": req_id, "path": path }
                                    }));
                                    pwd_request_id = None;
                                    pwd_buffer.clear();
                                    suppress_until = Some(Instant::now() + Duration::from_millis(300));
                                    continue;
                                }
                            }
                            continue;
                        }
                        if let Some(until) = suppress_until {
                            if Instant::now() < until { continue; }
                            suppress_until = None;
                        }
                        if let Some(output) =
                            process_shell_integration_output(&mut shell_integration, &text, event_tx)
                        {
                            if !output.is_empty() {
                                let _ = event_tx.send(json!({ "type": "output", "data": output }));
                            }
                        }
                    }
                    ChannelMsg::Eof | ChannelMsg::Close => break,
                    _ => {}
                }
            }
            _ = monitor_interval.tick(), if monitor_enabled => {
                collect_monitor_snapshot(
                    handle, event_tx,
                    &mut prev_cpu_sample, &mut prev_per_core_samples,
                    &mut prev_net_sample, &mut prev_sample_time,
                    cpu_core_count,
                ).await;
            }
            else => break,
        }
    }
}

async fn handle_monitor_init(
    handle: &client::Handle<KnownHostsHandler>,
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
    cpu_core_count: &mut u32,
) {
    if let Ok(raw) = russh_exec(handle, "uname -sr; echo \"===SEP===\"; hostname; echo \"===SEP===\"; whoami; echo \"===SEP===\"; cat /proc/uptime; echo \"===SEP===\"; nproc").await {
        let parts: Vec<&str> = raw.split("===SEP===").map(|s| s.trim()).collect();
        let os = parts.first().copied().unwrap_or("Linux");
        let host = parts.get(1).copied().unwrap_or("unknown");
        let user = parts.get(2).copied().unwrap_or("unknown");
        let uptime_sec = parts
            .get(3)
            .and_then(|s| s.split_whitespace().next())
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0);
        if let Some(count) = parts.get(4).and_then(|s| s.parse::<u32>().ok()) {
            *cpu_core_count = count.max(1);
        }
        let days = (uptime_sec / 86400.0).floor() as i64;
        let hours = ((uptime_sec % 86400.0) / 3600.0).floor() as i64;
        let mins = ((uptime_sec % 3600.0) / 60.0).floor() as i64;
        let uptime = format!("{days}d {hours}h {mins}m");
        let _ = event_tx.send(json!({
            "type": "monitor-info",
            "data": { "user": user, "host": host, "uptime": uptime, "os": os }
        }));
    }
}

#[allow(clippy::too_many_arguments)]
async fn collect_monitor_snapshot(
    handle: &client::Handle<KnownHostsHandler>,
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
    prev_cpu_sample: &mut Option<Vec<u64>>,
    prev_per_core_samples: &mut Option<Vec<Vec<u64>>>,
    prev_net_sample: &mut Option<HashMap<String, (u64, u64)>>,
    prev_sample_time: &mut Option<Instant>,
    cpu_core_count: u32,
) {
    let cmd = "cat /proc/stat; echo \"===SEP===\"; cat /proc/meminfo | grep -E \"^(MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree):\"; echo \"===SEP===\"; df -B1 2>/dev/null | tail -n +2; echo \"===SEP===\"; cat /proc/net/dev | tail -n +3; echo \"===SEP===\"; ps aux --sort=-%cpu 2>/dev/null | head -11";
    let Ok(raw) = russh_exec(handle, cmd).await else {
        return;
    };

    let sections: Vec<&str> = raw.split("===SEP===").map(|s| s.trim()).collect();
    let stat_lines: Vec<&str> = sections.first().copied().unwrap_or("").lines().collect();
    let mem_lines: Vec<&str> = sections.get(1).copied().unwrap_or("").lines().collect();
    let df_lines: Vec<&str> = sections.get(2).copied().unwrap_or("").lines().collect();
    let net_lines: Vec<&str> = sections.get(3).copied().unwrap_or("").lines().collect();
    let ps_lines: Vec<&str> = sections.get(4).copied().unwrap_or("").lines().collect();

    let (cpu_usage, cpu_kernel, cpu_user, cpu_io) = parse_cpu_total(&stat_lines, prev_cpu_sample);
    let cpu_per_core = parse_cpu_per_core(&stat_lines, prev_per_core_samples);
    let (mem_used, mem_total, swap_used, swap_total) = parse_memory(&mem_lines);
    let disks = parse_disks(&df_lines);
    let now = Instant::now();
    let elapsed = prev_sample_time
        .map(|t| now.duration_since(t).as_secs_f64())
        .unwrap_or(3.0);
    *prev_sample_time = Some(now);
    let (net_up, net_down, net_total_up, net_total_down, nics) =
        parse_network(&net_lines, prev_net_sample, elapsed);
    let processes = parse_processes(&ps_lines);

    let snapshot = json!({
        "cpuCores": cpu_core_count,
        "cpuUsage": cpu_usage, "cpuKernel": cpu_kernel,
        "cpuUser": cpu_user, "cpuIo": cpu_io,
        "cpuPerCore": cpu_per_core,
        "memUsed": mem_used, "memTotal": mem_total,
        "swapUsed": swap_used, "swapTotal": swap_total,
        "netUp": round1(net_up), "netDown": round1(net_down),
        "netTotalUp": net_total_up, "netTotalDown": net_total_down,
        "processes": processes, "nics": nics, "disks": disks,
    });
    let _ = event_tx.send(json!({ "type": "monitor-data", "data": snapshot }));
}

fn parse_cpu_total(
    stat_lines: &[&str],
    prev_cpu_sample: &mut Option<Vec<u64>>,
) -> (f64, f64, f64, f64) {
    let mut cpu_usage = 0.0;
    let mut cpu_kernel = 0.0;
    let mut cpu_user = 0.0;
    let mut cpu_io = 0.0;
    if let Some(line) = stat_lines.first() {
        let fields: Vec<u64> = line
            .replace("cpu", "")
            .split_whitespace()
            .filter_map(|v| v.parse::<u64>().ok())
            .collect();
        if fields.len() >= 5 {
            let total: u64 = fields.iter().sum();
            if let Some(prev) = prev_cpu_sample {
                let prev_total: u64 = prev.iter().sum();
                let d_total = total.saturating_sub(prev_total) as f64;
                let idle = *fields.get(3).unwrap_or(&0) + *fields.get(4).unwrap_or(&0);
                let prev_idle = *prev.get(3).unwrap_or(&0) + *prev.get(4).unwrap_or(&0);
                let d_idle = idle.saturating_sub(prev_idle) as f64;
                if d_total > 0.0 {
                    cpu_usage = round1((1.0 - d_idle / d_total) * 100.0);
                    let curr_system = *fields.get(2).unwrap_or(&0);
                    let prev_system = *prev.get(2).unwrap_or(&0);
                    cpu_kernel = round1(
                        ((curr_system.saturating_sub(prev_system)) as f64 / d_total) * 100.0,
                    );
                    let curr_user = *fields.get(0).unwrap_or(&0) + *fields.get(1).unwrap_or(&0);
                    let prev_user = *prev.get(0).unwrap_or(&0) + *prev.get(1).unwrap_or(&0);
                    cpu_user =
                        round1(((curr_user.saturating_sub(prev_user)) as f64 / d_total) * 100.0);
                    let curr_io = *fields.get(4).unwrap_or(&0);
                    let prev_io = *prev.get(4).unwrap_or(&0);
                    cpu_io = round1(((curr_io.saturating_sub(prev_io)) as f64 / d_total) * 100.0);
                }
            }
            *prev_cpu_sample = Some(fields);
        }
    }
    (cpu_usage, cpu_kernel, cpu_user, cpu_io)
}

fn parse_cpu_per_core(
    stat_lines: &[&str],
    prev_per_core_samples: &mut Option<Vec<Vec<u64>>>,
) -> Vec<f64> {
    let mut cpu_per_core: Vec<f64> = Vec::new();
    let mut per_core_samples: Vec<Vec<u64>> = Vec::new();
    for line in stat_lines.iter().skip(1) {
        if !line.starts_with("cpu") {
            break;
        }
        let fields: Vec<u64> = line
            .replace("cpu", "")
            .split_whitespace()
            .filter_map(|v| v.parse::<u64>().ok())
            .collect();
        if fields.len() < 5 {
            continue;
        }
        if let Some(prev_list) = prev_per_core_samples.as_ref() {
            if let Some(prev) = prev_list.get(per_core_samples.len()) {
                let total: u64 = fields.iter().sum();
                let prev_total: u64 = prev.iter().sum();
                let d_total = total.saturating_sub(prev_total) as f64;
                let idle = *fields.get(3).unwrap_or(&0) + *fields.get(4).unwrap_or(&0);
                let prev_idle = *prev.get(3).unwrap_or(&0) + *prev.get(4).unwrap_or(&0);
                let d_idle = idle.saturating_sub(prev_idle) as f64;
                let val = if d_total > 0.0 {
                    ((1.0 - d_idle / d_total) * 100.0).round()
                } else {
                    0.0
                };
                cpu_per_core.push(val);
            } else {
                cpu_per_core.push(0.0);
            }
        } else {
            cpu_per_core.push(0.0);
        }
        per_core_samples.push(fields);
    }
    *prev_per_core_samples = Some(per_core_samples);
    cpu_per_core
}

fn parse_memory(mem_lines: &[&str]) -> (f64, f64, f64, f64) {
    let mut mem_map: HashMap<String, u64> = HashMap::new();
    for line in mem_lines {
        let mut parts = line.split_whitespace();
        if let (Some(key), Some(val)) = (parts.next(), parts.next()) {
            let k = key.trim_end_matches(':').to_string();
            if let Ok(v) = val.parse::<u64>() {
                mem_map.insert(k, v);
            }
        }
    }
    let mem_total_kb = *mem_map.get("MemTotal").unwrap_or(&0) as f64;
    let mem_available_kb = if let Some(v) = mem_map.get("MemAvailable") {
        *v as f64
    } else {
        (*mem_map.get("MemFree").unwrap_or(&0)
            + *mem_map.get("Buffers").unwrap_or(&0)
            + *mem_map.get("Cached").unwrap_or(&0)) as f64
    };
    let mem_used = round1(((mem_total_kb - mem_available_kb) / 1024.0).max(0.0));
    let mem_total = round1(mem_total_kb / 1024.0);
    let swap_total = round1((*mem_map.get("SwapTotal").unwrap_or(&0) as f64) / 1024.0);
    let swap_used = round1(
        ((*mem_map.get("SwapTotal").unwrap_or(&0) - *mem_map.get("SwapFree").unwrap_or(&0)) as f64
            / 1024.0)
            .max(0.0),
    );
    (mem_used, mem_total, swap_used, swap_total)
}

fn parse_disks(df_lines: &[&str]) -> Vec<Value> {
    let mut disks = Vec::new();
    for line in df_lines {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() < 6 {
            continue;
        }
        let total_b = cols.get(1).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        let used_b = cols.get(2).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        if total_b == 0 {
            continue;
        }
        let total = round1(total_b as f64 / (1024.0 * 1024.0 * 1024.0));
        let used = round1(used_b as f64 / (1024.0 * 1024.0 * 1024.0));
        let percent = ((used_b as f64 / total_b as f64) * 100.0).floor();
        disks.push(json!({
            "name": cols[0],
            "used": used,
            "total": total,
            "percent": percent,
            "path": cols[5]
        }));
    }
    disks
}

fn parse_network(
    net_lines: &[&str],
    prev_net_sample: &mut Option<HashMap<String, (u64, u64)>>,
    elapsed: f64,
) -> (f64, f64, u64, u64, Vec<Value>) {
    let mut net_up = 0.0;
    let mut net_down = 0.0;
    let mut net_total_up: u64 = 0;
    let mut net_total_down: u64 = 0;
    let mut nics = Vec::new();
    let mut current_net_sample: HashMap<String, (u64, u64)> = HashMap::new();
    for line in net_lines {
        if let Some((name_part, data_part)) = line.split_once(':') {
            let name = name_part.trim().to_string();
            let cols: Vec<&str> = data_part.split_whitespace().collect();
            if cols.len() < 9 {
                continue;
            }
            let rx = cols
                .first()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(0);
            let tx = cols.get(8).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
            current_net_sample.insert(name.clone(), (rx, tx));
            net_total_up += tx;
            net_total_down += rx;
            let mut rx_rate = 0.0;
            let mut tx_rate = 0.0;
            if let Some(prev) = prev_net_sample.as_ref() {
                if let Some((prx, ptx)) = prev.get(&name) {
                    rx_rate = ((rx.saturating_sub(*prx)) as f64 / elapsed / 1024.0).max(0.0);
                    tx_rate = ((tx.saturating_sub(*ptx)) as f64 / elapsed / 1024.0).max(0.0);
                }
            }
            net_up += tx_rate;
            net_down += rx_rate;
            if name != "lo" {
                nics.push(json!({
                    "name": name,
                    "ip": "-",
                    "rxRate": round1(rx_rate),
                    "txRate": round1(tx_rate),
                    "rxTotal": rx,
                    "txTotal": tx
                }));
            }
        }
    }
    *prev_net_sample = Some(current_net_sample);
    (net_up, net_down, net_total_up, net_total_down, nics)
}

fn parse_processes(ps_lines: &[&str]) -> Vec<Value> {
    let mut processes = Vec::new();
    for line in ps_lines.iter().skip(1) {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() < 11 {
            continue;
        }
        let pid = cols.get(1).and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);
        let cpu = cols.get(2).unwrap_or(&"0").to_string() + "%";
        let mem = cols.get(3).unwrap_or(&"0").to_string() + "%";
        let name = cols
            .get(10)
            .unwrap_or(&"")
            .split('/')
            .last()
            .unwrap_or("")
            .split_whitespace()
            .next()
            .unwrap_or("")
            .to_string();
        processes.push(json!({
            "name": if name.is_empty() { cols.get(10).unwrap_or(&"").to_string() } else { name },
            "pid": pid,
            "cpu": cpu,
            "mem": mem,
        }));
    }
    processes
}
