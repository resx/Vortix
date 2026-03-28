use serde_json::{Value, json};

#[path = "shell_integration/bash_script.rs"]
mod bash_script;

const SHELL_INTEGRATION_OSC_PREFIX: &str = "\u{1b}]633;";
const SHELL_INTEGRATION_OSC_ST: &str = "\u{1b}\\";

#[derive(Default)]
pub(super) struct ShellIntegrationState {
    pub buffer: String,
    pub current_cwd: Option<String>,
    pub pending_command: Option<String>,
    pub ready_emitted: bool,
}

pub(super) fn bash_shell_integration_script() -> &'static str {
    bash_script::bash_shell_integration_script()
}

pub(super) fn emit_shell_integration_status(
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
    status: &'static str,
) {
    let _ = event_tx.send(json!({
        "type": "shell-integration-status",
        "data": { "status": status }
    }));
}

pub(super) fn process_shell_integration_output(
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
