use russh::keys::ssh_key::{HashAlg, PublicKey};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct HostKeySummary {
    pub key_type: String,
    pub fingerprint_sha256: String,
}

#[derive(Debug, Clone)]
pub enum HostKeyCheck {
    Trusted,
    Unknown,
    Mismatch { existing: HostKeySummary },
}

#[derive(Debug, Clone)]
enum KnownHostsLine {
    Raw(String),
    Parsed {
        original: String,
        host_patterns: Vec<String>,
        key_type: String,
        fingerprint_sha256: String,
    },
}

pub fn summarize_public_key(key: &PublicKey) -> HostKeySummary {
    HostKeySummary {
        key_type: key_type_name(key),
        fingerprint_sha256: key.fingerprint(HashAlg::Sha256).to_string(),
    }
}

pub fn inspect_known_host(
    path: &Path,
    host: &str,
    port: u16,
    presented_key: &PublicKey,
) -> Result<HostKeyCheck, String> {
    let target_pattern = format_host_pattern(host, port);
    let presented = summarize_public_key(presented_key);

    for line in load_known_hosts(path)? {
        let KnownHostsLine::Parsed {
            host_patterns,
            key_type,
            fingerprint_sha256,
            ..
        } = line
        else {
            continue;
        };

        if !host_patterns
            .iter()
            .any(|pattern| pattern == &target_pattern)
        {
            continue;
        }

        if key_type == presented.key_type {
            if fingerprint_sha256 == presented.fingerprint_sha256 {
                return Ok(HostKeyCheck::Trusted);
            }

            return Ok(HostKeyCheck::Mismatch {
                existing: HostKeySummary {
                    key_type,
                    fingerprint_sha256,
                },
            });
        }
    }

    Ok(HostKeyCheck::Unknown)
}

pub fn trust_known_host(
    path: &Path,
    host: &str,
    port: u16,
    key: &PublicKey,
    replace_existing: bool,
) -> Result<(), String> {
    let target_pattern = format_host_pattern(host, port);
    let rendered = render_known_host_line(&target_pattern, key)?;

    if replace_existing {
        let mut lines = Vec::new();
        let mut inserted = false;

        for line in load_known_hosts(path)? {
            match line {
                KnownHostsLine::Parsed {
                    original: _,
                    host_patterns,
                    key_type,
                    ..
                } if host_patterns
                    .iter()
                    .any(|pattern| pattern == &target_pattern)
                    && key_type == key_type_name(key) =>
                {
                    if !inserted {
                        lines.push(rendered.clone());
                        inserted = true;
                    }
                }
                KnownHostsLine::Raw(original) | KnownHostsLine::Parsed { original, .. } => {
                    lines.push(original)
                }
            }
        }

        if !inserted {
            lines.push(rendered);
        }

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建 known_hosts 目录失败: {e}"))?;
        }

        let content = if lines.is_empty() {
            String::new()
        } else {
            format!("{}\n", lines.join("\n"))
        };

        fs::write(path, content).map_err(|e| format!("写入 known_hosts 失败: {e}"))?;
        return Ok(());
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建 known_hosts 目录失败: {e}"))?;
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| format!("打开 known_hosts 失败: {e}"))?;

    writeln!(file, "{rendered}").map_err(|e| format!("追加 known_hosts 失败: {e}"))?;
    Ok(())
}

fn load_known_hosts(path: &Path) -> Result<Vec<KnownHostsLine>, String> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(err) => return Err(format!("读取 known_hosts 失败: {err}")),
    };

    Ok(content
        .lines()
        .map(|line| {
            if let Some((host_patterns, key_type, fingerprint_sha256)) = parse_known_host_line(line)
            {
                KnownHostsLine::Parsed {
                    original: line.to_string(),
                    host_patterns,
                    key_type,
                    fingerprint_sha256,
                }
            } else {
                KnownHostsLine::Raw(line.to_string())
            }
        })
        .collect())
}

fn parse_known_host_line(line: &str) -> Option<(Vec<String>, String, String)> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return None;
    }

    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    let (hosts_idx, key_type_idx, key_data_idx) = if parts.first()?.starts_with('@') {
        if parts.len() < 4 {
            return None;
        }
        (1, 2, 3)
    } else {
        if parts.len() < 3 {
            return None;
        }
        (0, 1, 2)
    };

    let encoded_key = format!("{} {}", parts[key_type_idx], parts[key_data_idx]);
    let public_key = PublicKey::from_openssh(&encoded_key).ok()?;
    let summary = summarize_public_key(&public_key);

    Some((
        parts[hosts_idx]
            .split(',')
            .map(|pattern| pattern.to_string())
            .collect(),
        summary.key_type,
        summary.fingerprint_sha256,
    ))
}

fn render_known_host_line(host_pattern: &str, key: &PublicKey) -> Result<String, String> {
    let encoded = key
        .to_openssh()
        .map_err(|e| format!("编码 SSH 公钥失败: {e}"))?;
    Ok(format!("{host_pattern} {encoded}"))
}

fn key_type_name(key: &PublicKey) -> String {
    key.to_openssh()
        .ok()
        .and_then(|encoded| encoded.split_whitespace().next().map(str::to_string))
        .unwrap_or_else(|| key.fingerprint(HashAlg::Sha256).to_string())
}

fn format_host_pattern(host: &str, port: u16) -> String {
    format!("[{host}]:{port}")
}
