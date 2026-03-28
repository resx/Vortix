use russh::client;
use russh::keys::PrivateKeyWithHashAlg;
use std::sync::Arc;

use super::super::json_utils::format_private_key_parse_error;
use super::types::RusshAuthConfig;

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
