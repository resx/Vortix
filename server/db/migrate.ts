/* ── 数据库迁移：建表 + 初始数据 ── */

import { getDb } from './database.js'

export function runMigrations(): void {
  const db = getDb()

  // 使用事务确保原子性
  db.transaction(() => {
    // 文件夹表
    db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE SET NULL
      )
    `)

    // SSH 连接表
    db.exec(`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        folder_id TEXT,
        name TEXT NOT NULL,
        protocol TEXT DEFAULT 'ssh',
        host TEXT NOT NULL,
        port INTEGER DEFAULT 22,
        username TEXT NOT NULL,
        auth_method TEXT DEFAULT 'password',
        encrypted_password TEXT,
        encrypted_private_key TEXT,
        sort_order INTEGER DEFAULT 0,
        remark TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
      )
    `)

    // 设置键值对表
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    // 命令历史表
    db.exec(`
      CREATE TABLE IF NOT EXISTS command_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id TEXT NOT NULL,
        command TEXT NOT NULL,
        executed_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
      )
    `)

    // 连接日志表
    db.exec(`
      CREATE TABLE IF NOT EXISTS connection_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id TEXT NOT NULL,
        event TEXT NOT NULL,
        message TEXT DEFAULT '',
        duration_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
      )
    `)

    // 加密元数据表
    db.exec(`
      CREATE TABLE IF NOT EXISTS encryption_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `)

    // 创建索引
    db.exec(`CREATE INDEX IF NOT EXISTS idx_connections_folder ON connections(folder_id)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_history_connection ON command_history(connection_id)`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_connection ON connection_logs(connection_id)`)
  })()

  // 扩展字段迁移（兼容已有数据库）
  const alterColumns = [
    `color_tag TEXT DEFAULT NULL`,
    `environment TEXT DEFAULT '无'`,
    `auth_type TEXT DEFAULT 'password'`,
    `proxy_type TEXT DEFAULT '关闭'`,
    `proxy_host TEXT DEFAULT '127.0.0.1'`,
    `proxy_port INTEGER DEFAULT 7890`,
    `proxy_username TEXT DEFAULT ''`,
    `proxy_password TEXT DEFAULT ''`,
    `proxy_timeout INTEGER DEFAULT 5`,
    `jump_server_id TEXT DEFAULT NULL`,
    `tunnels TEXT DEFAULT '[]'`,
    `env_vars TEXT DEFAULT '[]'`,
    `advanced TEXT DEFAULT '{}'`,
  ]

  for (const col of alterColumns) {
    try {
      db.exec(`ALTER TABLE connections ADD COLUMN ${col}`)
    } catch {
      // 列已存在，忽略
    }
  }

  console.log('[Vortix] 数据库迁移完成')
}
