use russh::client;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use super::types::{
    EstablishRusshSessionError, HostKeyConnectDecision, KnownHostsConnectFailure,
    KnownHostsHandler, RusshEndpoint, build_known_hosts_handler, map_connect_failure,
};

pub async fn establish_russh_session_with_context(
    endpoint: &RusshEndpoint,
    known_hosts_path: PathBuf,
    decision: HostKeyConnectDecision,
) -> Result<client::Handle<KnownHostsHandler>, EstablishRusshSessionError> {
    let config = Arc::new(client::Config::default());
    let failure: Arc<Mutex<Option<KnownHostsConnectFailure>>> = Arc::new(Mutex::new(None));
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
