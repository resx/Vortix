use std::sync::OnceLock;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use tokio::sync::RwLock;

use crate::server::types::SyncStateRow;

const SYNC_STATE_CACHE_TTL: Duration = Duration::from_secs(3);

struct CachedSyncState {
    state: SyncStateRow,
    expires_at: Instant,
    version: u64,
}

static CACHE: OnceLock<RwLock<Option<CachedSyncState>>> = OnceLock::new();
static CACHE_VERSION: AtomicU64 = AtomicU64::new(1);

fn cache() -> &'static RwLock<Option<CachedSyncState>> {
    CACHE.get_or_init(|| RwLock::new(None))
}

pub(super) async fn get() -> Option<SyncStateRow> {
    let current_version = CACHE_VERSION.load(Ordering::Relaxed);
    let guard = cache().read().await;
    let item = guard.as_ref()?;
    if item.version != current_version || Instant::now() > item.expires_at {
        return None;
    }
    Some(item.state.clone())
}

pub(super) async fn put(state: SyncStateRow) {
    let mut guard = cache().write().await;
    *guard = Some(CachedSyncState {
        state,
        expires_at: Instant::now() + SYNC_STATE_CACHE_TTL,
        version: CACHE_VERSION.load(Ordering::Relaxed),
    });
}

pub fn invalidate_sync_state_cache() {
    CACHE_VERSION.fetch_add(1, Ordering::Relaxed);
}
