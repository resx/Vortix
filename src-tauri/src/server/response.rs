/* ── 统一 API 响应类型 ── */

use axum::{http::StatusCode, response::Json};
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// 类型别名：路由 handler 的统一错误返回
pub type ApiError = (StatusCode, Json<ApiResponse<Value>>);

pub fn ok<T: Serialize>(data: T) -> Json<ApiResponse<T>> {
    Json(ApiResponse {
        success: true,
        data: Some(data),
        error: None,
    })
}

pub fn ok_empty() -> Json<ApiResponse<Value>> {
    Json(ApiResponse {
        success: true,
        data: None,
        error: None,
    })
}

pub fn err(status: StatusCode, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(ApiResponse {
            success: false,
            data: None,
            error: Some(message.into()),
        }),
    )
}
