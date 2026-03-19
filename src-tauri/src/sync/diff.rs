use std::collections::HashSet;

use crate::sync::chunk::ChunkData;
use crate::sync::types::SyncManifestV4;

pub fn filter_missing_chunks(
    local_chunks: &[ChunkData],
    remote_manifest: Option<&SyncManifestV4>,
) -> Vec<ChunkData> {
    let mut remote_hashes: HashSet<&str> = HashSet::new();
    if let Some(manifest) = remote_manifest {
        for c in &manifest.data.chunks {
            remote_hashes.insert(c.hash.as_str());
        }
    }
    local_chunks
        .iter()
        .filter(|c| !remote_hashes.contains(c.hash.as_str()))
        .cloned()
        .collect()
}
