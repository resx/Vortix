mod core;
mod provider_impl;
mod repo_ops;
mod repo_state;

#[derive(Clone)]
pub struct GitProvider {
    pub(crate) url: String,
    pub(crate) branch: String,
    pub(crate) subdir: String,
    pub(crate) sync_rel_path: String,
    pub(crate) username: Option<String>,
    pub(crate) password: Option<String>,
    pub(crate) ssh_key: Option<String>,
    pub(crate) work_dir: std::path::PathBuf,
}
