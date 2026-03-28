use serde_json::{Map, Value};

use crate::server::types::{ThemeImportItem, ThemeImportResult};

use super::helpers::{
    default_highlights, detect_theme_format, get_str, is_dark, iterm_color_to_hex, merge_highlights,
};

fn parse_vortix_theme(data: &Value) -> ThemeImportResult {
    let errors = Vec::new();
    let Some(obj) = data.as_object() else {
        return ThemeImportResult {
            format: "vortix".to_string(),
            themes: Vec::new(),
            errors: vec!["缺少 theme 字段".to_string()],
        };
    };
    let Some(theme_val) = obj.get("theme") else {
        return ThemeImportResult {
            format: "vortix".to_string(),
            themes: Vec::new(),
            errors: vec!["缺少 theme 字段".to_string()],
        };
    };
    let empty = Map::new();
    let theme = theme_val.as_object().unwrap_or(&empty);
    let name = theme
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Imported Theme")
        .to_string();
    let mode = theme
        .get("mode")
        .and_then(|v| v.as_str())
        .unwrap_or("dark")
        .to_string();
    let author = theme
        .get("author")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let terminal = theme
        .get("terminal")
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));
    let highlights = merge_highlights(theme.get("highlights"));
    let ui = theme.get("ui").cloned();
    ThemeImportResult {
        format: "vortix".to_string(),
        themes: vec![ThemeImportItem {
            name,
            mode,
            version: 1,
            author,
            terminal,
            highlights,
            ui,
        }],
        errors,
    }
}

fn parse_windows_terminal(data: &Value) -> ThemeImportResult {
    let errors = Vec::new();
    let mut schemes: Vec<Value> = Vec::new();
    if let Some(obj) = data.as_object() {
        if let Some(arr) = obj.get("schemes").and_then(|v| v.as_array()) {
            schemes.extend(arr.iter().cloned());
        }
    }
    if schemes.is_empty() {
        schemes.push(data.clone());
    }

    let themes = schemes
        .into_iter()
        .filter_map(|scheme| {
            let obj = scheme.as_object()?;
            let bg = get_str(obj.get("background")).unwrap_or("#0C0C0C".to_string());
            let fg = get_str(obj.get("foreground")).unwrap_or("#CCCCCC".to_string());
            let cursor = get_str(obj.get("cursorColor")).unwrap_or_else(|| fg.clone());
            let mut t = Map::new();
            t.insert("background".to_string(), Value::String(bg.clone()));
            t.insert("foreground".to_string(), Value::String(fg));
            t.insert("cursor".to_string(), Value::String(cursor));
            if let Some(v) = get_str(obj.get("selectionBackground")) {
                t.insert("selectionBackground".to_string(), Value::String(v));
            }
            for (json_key, term_key) in [
                ("black", "black"),
                ("red", "red"),
                ("green", "green"),
                ("yellow", "yellow"),
                ("blue", "blue"),
                ("cyan", "cyan"),
                ("white", "white"),
                ("brightBlack", "brightBlack"),
                ("brightRed", "brightRed"),
                ("brightGreen", "brightGreen"),
                ("brightYellow", "brightYellow"),
                ("brightBlue", "brightBlue"),
                ("brightCyan", "brightCyan"),
                ("brightWhite", "brightWhite"),
            ] {
                if let Some(v) = get_str(obj.get(json_key)) {
                    t.insert(term_key.to_string(), Value::String(v));
                }
            }
            if let Some(v) = get_str(obj.get("purple")).or_else(|| get_str(obj.get("magenta"))) {
                t.insert("magenta".to_string(), Value::String(v));
            }
            if let Some(v) =
                get_str(obj.get("brightPurple")).or_else(|| get_str(obj.get("brightMagenta")))
            {
                t.insert("brightMagenta".to_string(), Value::String(v));
            }
            Some(ThemeImportItem {
                name: get_str(obj.get("name")).unwrap_or("Windows Terminal Theme".to_string()),
                mode: if is_dark(&bg) {
                    "dark".to_string()
                } else {
                    "light".to_string()
                },
                version: 1,
                author: "".to_string(),
                terminal: Value::Object(t),
                highlights: Value::Object(default_highlights()),
                ui: None,
            })
        })
        .collect();
    ThemeImportResult {
        format: "windows-terminal".to_string(),
        themes,
        errors,
    }
}

fn parse_iterm2(data: &Value) -> ThemeImportResult {
    let errors = Vec::new();
    let mut terminal = Map::new();
    let bg = data
        .get("Background Color")
        .and_then(iterm_color_to_hex)
        .unwrap_or("#000000".to_string());
    let fg = data
        .get("Foreground Color")
        .and_then(iterm_color_to_hex)
        .unwrap_or("#FFFFFF".to_string());
    terminal.insert("background".to_string(), Value::String(bg.clone()));
    terminal.insert("foreground".to_string(), Value::String(fg));
    if let Some(v) = data.get("Cursor Color").and_then(iterm_color_to_hex) {
        terminal.insert("cursor".to_string(), Value::String(v));
    }
    if let Some(v) = data.get("Selection Color").and_then(iterm_color_to_hex) {
        terminal.insert("selectionBackground".to_string(), Value::String(v));
    }
    for (iterm_key, term_key) in [
        ("Ansi 0 Color", "black"),
        ("Ansi 1 Color", "red"),
        ("Ansi 2 Color", "green"),
        ("Ansi 3 Color", "yellow"),
        ("Ansi 4 Color", "blue"),
        ("Ansi 5 Color", "magenta"),
        ("Ansi 6 Color", "cyan"),
        ("Ansi 7 Color", "white"),
        ("Ansi 8 Color", "brightBlack"),
        ("Ansi 9 Color", "brightRed"),
        ("Ansi 10 Color", "brightGreen"),
        ("Ansi 11 Color", "brightYellow"),
        ("Ansi 12 Color", "brightBlue"),
        ("Ansi 13 Color", "brightMagenta"),
        ("Ansi 14 Color", "brightCyan"),
        ("Ansi 15 Color", "brightWhite"),
    ] {
        if let Some(v) = data.get(iterm_key).and_then(iterm_color_to_hex) {
            terminal.insert(term_key.to_string(), Value::String(v));
        }
    }
    ThemeImportResult {
        format: "iterm2".to_string(),
        themes: vec![ThemeImportItem {
            name: "iTerm2 Theme".to_string(),
            mode: if is_dark(&bg) {
                "dark".to_string()
            } else {
                "light".to_string()
            },
            version: 1,
            author: "".to_string(),
            terminal: Value::Object(terminal),
            highlights: Value::Object(default_highlights()),
            ui: None,
        }],
        errors,
    }
}

pub(super) fn import_theme_raw(raw: &str) -> ThemeImportResult {
    let parsed: Value = match serde_json::from_str(raw) {
        Ok(v) => v,
        Err(e) => {
            return ThemeImportResult {
                format: "unknown".to_string(),
                themes: Vec::new(),
                errors: vec![format!("JSON 解析失败: {}", e)],
            };
        }
    };
    match detect_theme_format(&parsed).as_str() {
        "vortix" => parse_vortix_theme(&parsed),
        "windows-terminal" => parse_windows_terminal(&parsed),
        "iterm2" => parse_iterm2(&parsed),
        _ => ThemeImportResult {
            format: "unknown".to_string(),
            themes: Vec::new(),
            errors: vec!["无法识别的主题格式".to_string()],
        },
    }
}
