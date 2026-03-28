use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
pub struct CreateThemeDto {
    pub name: String,
    pub mode: String,
    pub terminal: Option<Value>,
    pub highlights: Option<Value>,
    pub ui: Option<Value>,
    pub author: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
pub struct UpdateThemeDto {
    pub name: Option<String>,
    pub mode: Option<String>,
    pub terminal: Option<Value>,
    pub highlights: Option<Value>,
    pub ui: Option<Value>,
    pub author: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
pub struct PickDirBody {
    pub initialDir: Option<String>,
}

#[derive(Deserialize)]
pub struct PickFileBody {
    pub title: Option<String>,
    pub filters: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
pub struct PickSavePathBody {
    pub fileName: Option<String>,
    pub filters: Option<String>,
}

pub struct ThemeImportItem {
    pub name: String,
    pub mode: String,
    pub version: i64,
    pub author: String,
    pub terminal: Value,
    pub highlights: Value,
    pub ui: Option<Value>,
}

pub struct ThemeImportResult {
    pub format: String,
    pub themes: Vec<ThemeImportItem>,
    pub errors: Vec<String>,
}
