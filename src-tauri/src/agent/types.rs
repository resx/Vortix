use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatus {
    pub enabled: bool,
    pub running: bool,
    pub pid: Option<u32>,
    pub endpoint: String,
    pub transport: String,
    pub binary_path: String,
    pub last_error: Option<String>,
}
