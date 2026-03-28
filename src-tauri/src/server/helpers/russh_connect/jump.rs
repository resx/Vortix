use russh::client;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use super::auth::authenticate_russh_handle;
use super::establish::establish_russh_session_with_context;
use super::types::{
    EstablishRusshSessionError, HostKeyConnectDecision, KnownHostsConnectFailure,
    KnownHostsHandler, RusshEndpoint, RusshJumpHostConfig, build_known_hosts_handler,
    map_connect_failure,
};

pub struct EstablishedRusshConnection {
    pub handle: client::Handle<KnownHostsHandler>,
    _jump_handle: Option<client::Handle<KnownHostsHandler>>,
}

pub async fn establish_russh_session_via_jump(
    target: &RusshEndpoint,
    known_hosts_path: PathBuf,
    target_decision: HostKeyConnectDecision,
    jump: &RusshJumpHostConfig,
    jump_decision: HostKeyConnectDecision,
) -> Result<EstablishedRusshConnection, EstablishRusshSessionError> {
    let mut jump_handle =
        establish_russh_session_with_context(&jump.endpoint, known_hosts_path.clone(), jump_decision)
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
    let failure: Arc<Mutex<Option<KnownHostsConnectFailure>>> = Arc::new(Mutex::new(None));
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
