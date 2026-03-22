use bytes::Bytes;
use flate2::{Compression, write::ZlibEncoder};
use rayon::prelude::*;
use std::io::Write;

use crate::sync::types::{SyncChunkInfo, SyncHashAlg, SyncManifestDataV4};

#[derive(Clone)]
pub struct ChunkData {
    pub hash: String,
    pub raw_size: u64,
    pub stored_size: u64,
    pub compressed: bool,
    pub bytes: Bytes,
}

#[derive(Clone)]
pub struct ChunkedPayload {
    pub manifest: SyncManifestDataV4,
    pub chunks: Vec<ChunkData>,
}

fn hash_chunk(chunk: &[u8], alg: SyncHashAlg) -> String {
    match alg {
        SyncHashAlg::Blake3 => blake3::hash(chunk).to_hex().to_string(),
        SyncHashAlg::Xxhash64 => {
            let v = xxhash_rust::xxh3::xxh3_64(chunk);
            format!("{:016x}", v)
        }
    }
}

fn compress_chunk(chunk: &[u8]) -> Option<Vec<u8>> {
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
    if encoder.write_all(chunk).is_err() {
        return None;
    }
    let compressed = encoder.finish().ok()?;
    if compressed.len() + 8 < chunk.len() {
        Some(compressed)
    } else {
        None
    }
}

pub fn chunk_bytes(
    input: &[u8],
    chunk_size: usize,
    hash_alg: SyncHashAlg,
    enable_compression: bool,
) -> ChunkedPayload {
    let total_size = input.len() as u64;
    let chunks: Vec<ChunkData> = input
        .par_chunks(chunk_size.max(1))
        .map(|chunk| {
            let hash = hash_chunk(chunk, hash_alg);
            if enable_compression {
                if let Some(compressed) = compress_chunk(chunk) {
                    let stored_size = compressed.len() as u64;
                    return ChunkData {
                        hash,
                        raw_size: chunk.len() as u64,
                        stored_size,
                        compressed: true,
                        bytes: Bytes::from(compressed),
                    };
                }
            }
            ChunkData {
                hash,
                raw_size: chunk.len() as u64,
                stored_size: chunk.len() as u64,
                compressed: false,
                bytes: Bytes::copy_from_slice(chunk),
            }
        })
        .collect();

    let manifest = SyncManifestDataV4 {
        format: "chunks".to_string(),
        total_size,
        chunks: chunks
            .iter()
            .map(|c| SyncChunkInfo {
                hash: c.hash.clone(),
                size: c.raw_size,
                stored_size: c.stored_size,
                compressed: c.compressed,
            })
            .collect(),
    };

    ChunkedPayload { manifest, chunks }
}

pub fn decompress_chunk(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = flate2::read::ZlibDecoder::new(data);
    let mut buf = Vec::new();
    std::io::Read::read_to_end(&mut decoder, &mut buf)
        .map_err(|e| format!("decompress failed: {}", e))?;
    Ok(buf)
}
