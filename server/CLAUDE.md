[根目录](../CLAUDE.md) > **server (后端)**

# server/ -- 后端模块

## 变更记录 (Changelog)

| 时间 | 变更内容 |
|------|----------|
| 2026-03-12T03:04:15 | 初始生成：完整后端架构文档 |

## 模块职责

Express 5 + WebSocket：SSH 终端代理、SFTP、REST API、本地终端(node-pty)、云同步。

## 入口与启动

`index.ts`(HTTP+WS) -> `app.ts`(Express+12路由)。流程：migrateToJson -> initStores -> setupWS(ssh+sftp) -> autoSync.init -> listen(:3001)

## 对外接口

### REST API（/api）

| 路由 | 职责 |
|------|------|
| /health | 健康检查 |
| /folders | 文件夹 CRUD |
| /connections | 连接 CRUD + 凭据解密 + 批量编辑 |
| /settings | 设置 get/put/reset |
| /history | 命令历史 |
| /fs | 本地文件系统 |
| /logs | 连接日志 |
| /shortcuts | 快捷命令 CRUD |
| /ssh-keys | SSH 密钥 CRUD + 生成 + 导出 |
| /sync | 云同步 export/import/status |
| /presets | 连接预设 CRUD [新增] |
| /editor/* | 外部编辑器启动 [新增] |

### WebSocket

/ws/ssh (终端 I/O) | /ws/sftp (SFTP 文件操作 [新增], 17+16 消息类型)

## 关键依赖

express 5, ssh2, ws, node-pty, simple-git, webdav, @aws-sdk/client-s3

## 数据存储层（db/）

`json-store.ts`(单对象), `jsonl-store.ts`(追加集合), `stores.ts`(实例), `migrate-to-json.ts`(SQLite迁移)

## Repositories（数据访问层）

| Repository | 职责 |
|------------|------|
| folder.repository | 文件夹 CRUD |
| connection.repository | 连接 CRUD + 凭据加解密 + 批量 |
| settings.repository | 设置读写 |
| history.repository | 命令历史 |
| log.repository | 连接日志 |
| shortcut.repository | 快捷命令 |
| sshkey.repository | SSH 密钥（AES-256-GCM） |
| preset.repository | 连接预设 [新增] |

## Services（业务服务层）

| Service | 职责 |
|---------|------|
| crypto.service.ts | AES-256-GCM 加解密 |
| ssh.service.ts | SSH 连接管理 |
| sftp.service.ts [新增] | SFTP Promise API 封装（listDir/mkdir/rename/remove/stat/readFile/writeFile/chmod/touch/exec） |
| sync.service.ts | 云同步 export/import/purge |
| sync-state.service.ts | 同步状态追踪 |
| auto-sync.service.ts | 自动同步调度 |
| sync-providers/ | 多源同步（local/git/webdav/s3） |

## 其他文件

- `middleware/error.ts` -- 统一错误处理中间件
- `highlight-interceptor.ts` -- 后端 ANSI 高亮拦截器
- `types/index.ts` -- 后端类型（ApiResponse, Folder, Connection, ConnectionRow, Preset, SshKey, SyncPayload 等 ~50 接口）
- `types/sftp.ts` [新增] -- SFTP 类型（SftpFileEntry, TransferTask, 17 WS 消息 data 接口, EXEC_ALLOWED_COMMANDS 白名单）

## 测试与质量

无测试框架。ESLint 配置于根目录。

## 常见问题 (FAQ)

- SFTP exec 白名单：仅允许 cp/mv/tar/zip/unzip/gzip/gunzip/chmod/chown/ln/cat/du/df
- 凭据安全：所有密码/私钥通过 crypto.service AES-256-GCM 加密存储，API 响应不返回加密字段
- 同步格式：v3 JSON 格式，支持 builtin/user 两种加密模式

## 相关文件清单

```
server/
├── index.ts, app.ts, ssh-server.ts
├── db/: json-store.ts, jsonl-store.ts, stores.ts, migrate-to-json.ts
├── repositories/: folder, connection, settings, history, log, shortcut, sshkey, preset
├── services/: crypto, ssh, sftp[新], sync, sync-state, auto-sync
├── services/sync-providers/: types, index, local, git, webdav, s3
├── routes/: health, folders, connections, settings, history, fs, logs, shortcuts, sshkeys, sync, presets[新], editor[新]
├── ws/: ssh.handler, sftp.handler[新], local.handler
├── middleware/error.ts, highlight-interceptor.ts
└── types/: index.ts, sftp.ts[新]
```
