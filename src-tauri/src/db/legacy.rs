mod archive;
mod importer;
mod models;
mod readers;

use std::path::Path;

pub use archive::{archive_legacy_data, generate_device_id};
pub use importer::import_all;

pub fn has_legacy_data(legacy_dir: &Path) -> bool {
    let config = legacy_dir.join("config");
    let logs = legacy_dir.join("logs");
    config.exists() || logs.exists() || legacy_dir.join("sync-state.json").exists()
}
