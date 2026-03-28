/* ── SSH 密钥 CRUD + 导出 + 生成 ── */

#[path = "ssh_keys/archive.rs"]
mod archive;
#[path = "ssh_keys/generate.rs"]
mod generate;
#[path = "ssh_keys/handlers.rs"]
mod handlers;

pub use generate::generate_ssh_key;
pub use handlers::{
    create_ssh_key, delete_ssh_key, export_ssh_key, get_ssh_key, get_ssh_key_credential,
    get_ssh_key_private, get_ssh_keys, update_ssh_key,
};
