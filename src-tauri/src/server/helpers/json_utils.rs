use serde_json::Value;

pub fn parse_json_value(raw: &str, fallback: Value) -> Value {
    serde_json::from_str(raw).unwrap_or(fallback)
}

pub fn value_to_json_string(value: &Value, fallback: &str) -> String {
    match value {
        Value::Null => fallback.to_string(),
        Value::String(s) => s.clone(),
        _ => serde_json::to_string(value).unwrap_or_else(|_| fallback.to_string()),
    }
}

pub fn string_or_default(value: String, fallback: &str) -> String {
    if value.trim().is_empty() {
        fallback.to_string()
    } else {
        value
    }
}

pub fn format_private_key_parse_error<E>(error: E, passphrase_supplied: bool) -> String
where
    E: std::fmt::Display,
{
    let raw = error.to_string();
    let normalized = raw.to_ascii_lowercase();
    if !passphrase_supplied
        && (normalized.contains("the key is encrypted") || normalized.contains("key is encrypted"))
    {
        "Private key is encrypted. Please provide the passphrase.".to_string()
    } else {
        format!("Private key parse failed: {raw}")
    }
}
