use serde_json::{Map, Value};

pub(super) fn default_highlights() -> Map<String, Value> {
    let mut map = Map::new();
    for (k, v) in [
        ("error", "#F44747"),
        ("warning", "#E6A23C"),
        ("ok", "#6A9955"),
        ("info", "#569CD6"),
        ("debug", "#808080"),
        ("ipMac", "#CE9178"),
        ("path", "#4EC9B0"),
        ("url", "#569CD6"),
        ("timestamp", "#DCDCAA"),
        ("env", "#C586C0"),
    ] {
        map.insert(k.to_string(), Value::String(v.to_string()));
    }
    map
}

pub(super) fn is_dark(hex: &str) -> bool {
    let h = hex.trim_start_matches('#');
    if h.len() < 6 {
        return true;
    }
    let r = u8::from_str_radix(&h[0..2], 16).unwrap_or(0) as f64;
    let g = u8::from_str_radix(&h[2..4], 16).unwrap_or(0) as f64;
    let b = u8::from_str_radix(&h[4..6], 16).unwrap_or(0) as f64;
    (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0 < 0.5
}

pub(super) fn get_str(value: Option<&Value>) -> Option<String> {
    value.and_then(|v| v.as_str()).map(|s| s.to_string())
}

pub(super) fn merge_highlights(custom: Option<&Value>) -> Value {
    let mut base = default_highlights();
    if let Some(Value::Object(map)) = custom {
        for (k, v) in map {
            base.insert(k.clone(), v.clone());
        }
    }
    Value::Object(base)
}

pub(super) fn sanitize_theme_filename(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        "theme".to_string()
    } else {
        out
    }
}

pub(super) fn detect_theme_format(data: &Value) -> String {
    if let Some(obj) = data.as_object() {
        if obj.get("format").and_then(|v| v.as_str()) == Some("vortix-theme-v1") {
            return "vortix".to_string();
        }
        if obj.get("schemes").and_then(|v| v.as_array()).is_some() {
            return "windows-terminal".to_string();
        }
        if obj.get("background").and_then(|v| v.as_str()).is_some()
            && obj.get("foreground").and_then(|v| v.as_str()).is_some()
            && obj.get("name").and_then(|v| v.as_str()).is_some()
        {
            return "windows-terminal".to_string();
        }
        if obj.get("Ansi 0 Color").is_some() || obj.get("Background Color").is_some() {
            return "iterm2".to_string();
        }
    }
    "unknown".to_string()
}

pub(super) fn iterm_color_to_hex(obj: &Value) -> Option<String> {
    let o = obj.as_object()?;
    let r = (o
        .get("Red Component")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
        * 255.0)
        .round()
        .clamp(0.0, 255.0) as u8;
    let g = (o
        .get("Green Component")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
        * 255.0)
        .round()
        .clamp(0.0, 255.0) as u8;
    let b = (o
        .get("Blue Component")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
        * 255.0)
        .round()
        .clamp(0.0, 255.0) as u8;
    Some(format!("#{:02x}{:02x}{:02x}", r, g, b))
}
