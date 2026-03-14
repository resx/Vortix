[根目录](../CLAUDE.md) > **src (前端)**

# src/ -- 前端模块

## 变更记录 (Changelog)

| 时间 | 变更内容 |
|------|----------|
| 2026-03-14T04:00:00 | 多窗口架构（SettingsWindow/DetachedTerminalView）、字体系统增强、设置响应式布局、Tauri 窗口控制 |
| 2026-03-12T03:04:15 | 初始生成：完整前端架构文档 |

## 模块职责

React 19 SPA：终端、SFTP、资产管理、设置、云同步 UI、服务器监控。无路由，单页应用。

## 入口与启动

- 主应用：`main.tsx` → `App.tsx` → `bootstrap.ts`（注册 context-menu/connection-type/settings-panel/dialog）
- 设置窗口：`settings-main.tsx` → `SettingsWindow.tsx`（独立入口，仅注册设置面板模块）
- 多窗口路由：`App.tsx` 根据 URL 参数分支渲染（`?detach=terminal` → DetachedTerminalView，默认 → MainApp）

## 对外接口

REST `api/client.ts` (localhost:3001/api) | WS SSH `/ws/ssh` | WS SFTP `/ws/sftp`

## 关键依赖

zustand, @xterm/xterm, @codemirror/*, framer-motion, @radix-ui/*, @iconify/react, recharts

## Stores（16 活跃 + 1 废弃）

| Store | 职责 |
|-------|------|
| useUIStore | 面板开关、右键菜单、SFTP/设置面板状态 |
| useTabStore | 标签页 CRUD、activeTabId |
| useAssetStore | 资产树、表格、CRUD、选择、ping |
| useSettingsStore | 全局设置、API 持久化、dirty 追踪 |
| useTerminalProfileStore | 终端外观配置 |
| useSshConfigStore | SSH 连接对话框状态 |
| useWorkspaceStore | 分屏/工作区 |
| useMonitorStore | 服务器监控 |
| useShortcutStore | 快捷命令 CRUD |
| useToastStore | Toast 通知 |
| useLocalTerminalConfigStore | 本地终端配置 |
| useThemeStore | 自定义主题管理 [新增] |
| useSftpStore | SFTP 浏览状态 |
| useTransferStore | 传输队列 |
| useSftpClipboardStore | SFTP 剪贴板 |
| useSftpBookmarkStore | SFTP 收藏 [persist] |
| terminalSessionRegistry | 终端会话生命周期 |

## 组件结构

- **layout/**: Header, ActivityBar, Sidebar
- **tabs/**: TabBar, ServerMonitor, TerminalSimulation
- **workspace/**: WorkspaceLayout -> SplitContainer -> SplitTreeRenderer -> TerminalPane
- **terminal/**: SshTerminal(xterm+WS), SshTerminalWrapper, SshConnectDialog, themes/
- **ssh-config/**: SshConfigDialog + 5 tabs + 6 modals
- **settings/**: SettingsPanel, BasicSettings, SSHSettings, DatabaseSettings, SyncSettings, KeyPickerModal, TermThemePanel, SettingControls
- **windows/** [新增]: SettingsWindow(独立设置窗口), DetachedTerminalView(分离终端窗口)
- **panels/**: SftpPanel(组合壳), ServerInfoPanel
- **panels/sftp/** [新增]: SftpToolbar, SftpPathBar, SftpFileList, SftpStatusBar, SftpContextMenu, SftpBookmarkPopover, SftpHistoryPopover, SftpUploadHelper, SftpDownloadHelper, useSftpActions
- **editor/** [新增]: RemoteFileEditor(CodeMirror 6 弹窗), useEditorLanguage(语言自动检测)
- **dialogs/**: BatchEditModal, ShortcutDialog, UpdateDialog, ClearDataDialog, ReloadConfirmDialog, QuickSearchDialog
- **assets/**: AssetToolbar, AssetTable, DirModal, HiddenShortcuts
- **icons/**: AppIcon(@iconify), ProtocolIcons, CustomIcons
- **ui/**: Switch, Select, Input, Tooltip, DropdownMenu(default/glass), IslandModal, Toast, HoverTooltip
- **local-terminal/**: LocalTerminalConfigDialog(PowerShell/CMD via node-pty)
- **context-menu/**: ContextMenu(旧版兼容)

## Features（插槽模块）

- **context-menu/**: ContextMenuShell + MenuParts + NewConnectionSubmenu + 6 menus(sidebar-asset, shortcut, table, tab, terminal, sftp-file[新增])
- **header/**: VortixLogo, HeaderIcons, HeaderToolbar, MainMenu, WindowControls + popovers/(TransferPopover, BroadcastPopover, HistoryPopover, SyncQuickPopover)
- **settings/**: register.ts（设置面板注册）
- **dialogs/**: DialogRenderer + register.ts
- **connection-types/**: register.ts（协议类型注册）

## Services [新增]

- `services/transfer-engine.ts` -- 传输执行引擎，桥接 useTransferStore 和 SFTP WS，分块上传/下载，速度计算
- `services/editor-launcher.ts` -- 外部编辑器启动（VSCode/Notepad++/Sublime/系统默认/自定义）
- `services/transfer-providers/types.ts` -- TransferProvider 接口（sftp/scp/trzsz/lrzsz）
- `services/transfer-providers/sftp.provider.ts` -- SFTP 传输实现

## Hooks

- `hooks/useAppEffects.ts` -- 全局副作用（初始化/主题/字体/缩放/动画/快捷键/跨窗口配置同步/窗口就绪显示）
- `hooks/useSftpConnection.ts` -- SFTP WS 连接生命周期，request/response 匹配，30s 超时

## Registries

- `registries/context-menu.registry.ts` -- 右键菜单注册
- `registries/connection-type.registry.ts` -- 连接协议注册
- `registries/settings-panel.registry.ts` -- 设置面板注册
- `registries/dialog.registry.ts` -- 对话框注册

## 类型定义

- `types/index.ts` -- TreeItem, AssetRow, AppTab, ContextMenuState 等核心类型
- `types/workspace.ts` -- 分屏相关类型
- `types/sftp.ts` [新增] -- SftpFileEntry, TransferTask, TransferStatus, BookmarkEntry, ExecResult, SftpMessage 等
- `types/terminal-profile.ts` -- 终端配置文件类型
- `types/theme.ts` [新增] -- 自定义主题类型
- `types/global.d.ts`, `types/fontsource.d.ts` -- 全局声明

## 其他

- `api/client.ts` + `api/types.ts` -- 统一 HTTP API 封装
- `lib/` -- utils(cn), fonts(字体映射+系统字体枚举), color-tag, window(Tauri v2 窗口控制), clipboard, download, theme-bridge, updater
- `i18n/` -- 国际化
- `data/` -- mock 数据（ssh-config-mock, mock）

## 测试与质量

无测试框架。无单元/集成/E2E 测试。ESLint 配置于根目录 `eslint.config.js`。

## 常见问题 (FAQ)

- 终端 fit 崩溃：确保使用 `safeFit()` 守卫，检查容器尺寸 > 0
- 新增右键菜单：在 `features/context-menu/menus/` 创建文件，在 `bootstrap.ts` 注册
- 新增设置面板：在 `features/settings/register.ts` 添加注册调用
