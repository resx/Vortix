use super::*;

pub(super) async fn ping_connections(
    State(db): State<Db>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<HashMap<String, Value>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let ids = body
        .get("ids")
        .and_then(|v| v.as_array())
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "ids 不能为空"))?;
    if ids.is_empty() {
        return Ok(ok(HashMap::new()));
    }
    if ids.len() > 50 {
        return Err(err(StatusCode::BAD_REQUEST, "批量 ping 数量不能超过 50"));
    }

    let mut results: HashMap<String, Value> = HashMap::new();
    let mut tasks = Vec::new();
    for id_val in ids {
        let Some(id) = id_val.as_str() else { continue };
        let db = db.clone();
        let id = id.to_string();
        tasks.push(tokio::spawn(async move {
            let row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
                .bind(&id)
                .fetch_optional(&db.pool)
                .await
                .ok()
                .flatten();
            if let Some(row) = row {
                if row.protocol == "local" || row.host.is_empty() {
                    return (id, Value::Null);
                }
                let start = Instant::now();
                let addr = format!("{}:{}", row.host, row.port);
                let ok = time::timeout(Duration::from_secs(5), TcpStream::connect(addr))
                    .await
                    .is_ok();
                if ok {
                    return (
                        id,
                        Value::Number((start.elapsed().as_millis() as i64).into()),
                    );
                }
            }
            (id, Value::Null)
        }));
    }
    for task in tasks {
        if let Ok((id, val)) = task.await {
            results.insert(id, val);
        }
    }
    Ok(ok(results))
}
