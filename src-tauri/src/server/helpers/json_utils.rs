use serde_json::{Map, Value};

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

pub fn json_values_equal_unordered(left: &Value, right: &Value) -> bool {
    match (left, right) {
        (Value::Null, Value::Null) => true,
        (Value::Bool(a), Value::Bool(b)) => a == b,
        (Value::Number(a), Value::Number(b)) => a == b,
        (Value::String(a), Value::String(b)) => a == b,
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len()
                && a.iter()
                    .zip(b.iter())
                    .all(|(left_item, right_item)| json_values_equal_unordered(left_item, right_item))
        }
        (Value::Object(a), Value::Object(b)) => json_maps_equal_unordered(a, b),
        _ => false,
    }
}

pub fn json_maps_equal_unordered(left: &Map<String, Value>, right: &Map<String, Value>) -> bool {
    left.len() == right.len()
        && left.iter().all(|(key, left_value)| {
            right
                .get(key)
                .is_some_and(|right_value| json_values_equal_unordered(left_value, right_value))
        })
}
