use anyhow::{Context, Result};
use serde::Deserialize;
use serde_json::Value;
use std::fs;
use std::path::Path;

pub(super) fn read_json_array<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<Option<Vec<T>>> {
    if !path.exists() {
        return Ok(None);
    }
    let content =
        fs::read_to_string(path).with_context(|| format!("读取文件失败: {}", path.display()))?;
    let data = serde_json::from_str::<Vec<T>>(&content)
        .with_context(|| format!("解析 JSON 失败: {}", path.display()))?;
    Ok(Some(data))
}

pub(super) fn read_json_object(path: &Path) -> Result<Option<serde_json::Map<String, Value>>> {
    if !path.exists() {
        return Ok(None);
    }
    let content =
        fs::read_to_string(path).with_context(|| format!("读取文件失败: {}", path.display()))?;
    let data = serde_json::from_str::<serde_json::Map<String, Value>>(&content)
        .with_context(|| format!("解析 JSON 失败: {}", path.display()))?;
    Ok(Some(data))
}

pub(super) fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<Option<T>> {
    if !path.exists() {
        return Ok(None);
    }
    let content =
        fs::read_to_string(path).with_context(|| format!("读取文件失败: {}", path.display()))?;
    let data = serde_json::from_str::<T>(&content)
        .with_context(|| format!("解析 JSON 失败: {}", path.display()))?;
    Ok(Some(data))
}

pub(super) fn read_jsonl<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<Option<Vec<T>>> {
    if !path.exists() {
        return Ok(None);
    }
    let content =
        fs::read_to_string(path).with_context(|| format!("读取文件失败: {}", path.display()))?;
    let mut rows = Vec::new();
    for (idx, line) in content.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let row = serde_json::from_str::<T>(line)
            .with_context(|| format!("解析 JSONL 失败: {}:{}", path.display(), idx + 1))?;
        rows.push(row);
    }
    Ok(Some(rows))
}
