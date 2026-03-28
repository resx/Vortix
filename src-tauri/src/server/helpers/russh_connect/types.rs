use russh::client;
use russh::keys::ssh_key::PublicKey;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::server::known_hosts::{self, HostKeyCheck};

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
pub(super) enum KnownHostsConnectFailure {
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

pub(super) fn build_known_hosts_handler(
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

pub(super) fn map_connect_failure(
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
