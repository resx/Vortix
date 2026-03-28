#[path = "bridge_connections/auth.rs"]
mod auth;
#[path = "bridge_connections/batch_ping.rs"]
mod batch_ping;
#[path = "bridge_connections/crud.rs"]
mod crud;
#[path = "bridge_connections/types.rs"]
mod types;

pub use auth::get_connection_credential;
pub use batch_ping::{batch_update_connections, ping_connections};
pub use crud::{
    create_connection, delete_connection, get_connection, list_connections, update_connection,
};
pub use types::{ConnectionCredentialRecord, ListConnectionsQuery};
