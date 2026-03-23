use chrono::Local;

pub fn now_rfc3339() -> String {
    Local::now().to_rfc3339()
}

pub fn now_compact() -> String {
    Local::now().format("%Y%m%d_%H%M%S").to_string()
}

pub fn now_timestamp() -> i64 {
    Local::now().timestamp()
}
