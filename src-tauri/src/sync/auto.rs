use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tokio::time::{sleep, Duration};

static AUTO_SYNC_ENABLED: AtomicBool = AtomicBool::new(true);

pub fn suspend() {
    AUTO_SYNC_ENABLED.store(false, Ordering::Relaxed);
}

pub fn resume() {
    AUTO_SYNC_ENABLED.store(true, Ordering::Relaxed);
}

pub fn spawn_loop(task: impl Fn() + Send + Sync + 'static) {
    let task = Arc::new(task);
    tokio::spawn(async move {
        loop {
            if AUTO_SYNC_ENABLED.load(Ordering::Relaxed) {
                task();
            }
            sleep(Duration::from_secs(30)).await;
        }
    });
}
