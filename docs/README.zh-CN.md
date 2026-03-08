<div align="center">

# Vortix

**现代化的浏览器端 SSH 与服务器管理工具**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](../README.md) | [简体中文](./README.zh-CN.md)

</div>

---

## 项目简介

Vortix 是一款精致的浏览器端 SSH 与服务器管理平台。它结合了现代化的 React SPA 前端和 Node.js WebSocket 后端，让你可以直接在浏览器中管理远程服务器、传输文件、监控系统资源。

## 截图预览

> 截图即将上线

## 核心功能

- **SSH 终端** — 基于 xterm.js 的全功能终端，通过 WebSocket 实现实时通信，支持密码和私钥认证、自动重连、关键词高亮
- **SFTP 文件管理** — 通过直观的侧边面板浏览、上传和下载远程服务器文件
- **服务器监控** — 实时仪表盘，展示 CPU、内存、磁盘和网络指标，配有交互式图表
- **资产管理** — 通过分组、标签和可搜索的资产树来组织服务器和连接
- **多标签工作区** — 在标签页界面中同时打开多个 SSH 会话，支持拖拽排序和分屏
- **云同步** — 多源数据同步（本地文件/Git/WebDAV/S3），支持加密导入导出
- **SSH 密钥库** — 持久化密钥管理，支持生成/导入/编辑/导出/删除
- **快捷命令** — 可复用命令片段管理
- **本地终端** — 通过 node-pty 后端实现本地 PowerShell/CMD 终端
- **设置面板** — 可配置的偏好设置，包括主题、字体、终端行为、数据库连接和 SSH 默认配置
- **右键菜单** — 支持对资产和标签页进行快捷操作的右键上下文菜单
- **流畅动画** — 基于 Framer Motion 的精致过渡动画和交互效果

## 项目优势

- **零安装使用** — 基于浏览器运行，无需在本地安装任何 SSH 客户端
- **现代化 UI** — 采用 Island 设计语言，卡片式布局，视觉清爽舒适
- **高性能** — Vite 7 极速构建，React 19 最新特性，Zustand 轻量状态管理
- **类型安全** — 全栈 TypeScript 开发，编译时捕获错误
- **可扩展架构** — 模块化组件设计，Zustand store 管理状态，易于扩展新功能
- **精致细节** — Apple Liquid Glass 毛玻璃效果、自定义滚动条、流畅过渡动画

## 技术栈

### 前端

| 技术 | 用途 |
|---|---|
| **React 19** | UI 框架，使用最新特性 |
| **TypeScript 5.9** | 类型安全的开发体验 |
| **Vite 7** | 极速构建工具 |
| **Tailwind CSS 4** | 原子化 CSS 样式，使用原生 `@theme` 配置 |
| **Zustand** | 轻量级状态管理 |
| **xterm.js** | 浏览器终端模拟器 |
| **Recharts** | 服务器监控数据可视化 |
| **Framer Motion** | 流畅的动画和过渡效果 |
| **Radix UI** | 无障碍的无头 UI 基础组件（下拉菜单、选择器、开关、工具提示） |
| **Lucide React** | 精美一致的图标库 |

### 后端

| 技术 | 用途 |
|---|---|
| **Node.js + Express 5** | HTTP 服务器和 REST API |
| **WebSocket (ws)** | 实时双向通信，用于终端 I/O |
| **ssh2** | SSH/SFTP 协议实现 |
| **better-sqlite3** | SQLite 数据持久化（WAL 模式） |
| **node-pty** | 本地终端进程管理 |

## 项目结构

```
Vortix/
├── src/
│   ├── components/
│   │   ├── assets/              # 资产表格、工具栏
│   │   ├── context-menu/        # 右键上下文菜单
│   │   ├── dialogs/             # 共享对话框组件
│   │   ├── icons/               # 自定义 SVG 图标组件
│   │   ├── layout/              # 顶栏、侧边栏、活动栏
│   │   ├── local-terminal/      # 本地终端配置
│   │   ├── panels/              # 服务器信息面板、SFTP 面板
│   │   ├── settings/            # 设置面板、云同步、SSH密钥管理器
│   │   ├── tabs/                # 标签栏、服务器监控
│   │   ├── terminal/            # SSH 终端、连接对话框、主题
│   │   ├── workspace/           # 分屏系统、工作区布局
│   │   └── ui/                  # 可复用 UI 基础组件
│   ├── stores/                  # Zustand 状态仓库
│   ├── api/                     # HTTP API 封装 + 类型定义
│   ├── i18n/                    # 国际化
│   ├── lib/                     # 工具函数
│   ├── App.tsx                  # 根应用组件
│   └── main.tsx                 # 入口文件
├── server/
│   ├── index.ts                 # HTTP + WSS 启动入口
│   ├── app.ts                   # Express app + 中间件
│   ├── db/                      # SQLite 数据库 + 迁移
│   ├── repositories/            # 数据访问层（CRUD）
│   ├── services/                # 加密、SSH、云同步服务
│   ├── routes/                  # REST API 路由
│   ├── ws/                      # WebSocket 处理器
│   └── types/                   # 后端类型定义
├── docs/                        # 项目文档
└── package.json
```

## 快速开始

### 环境要求

- **Node.js** >= 18
- **pnpm**（推荐的包管理器）

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/vortix.git
cd vortix

# 安装依赖
pnpm install
```

### 开发

```bash
# 启动前端开发服务器
pnpm dev

# 启动 SSH 后端服务（在另一个终端中）
pnpm dev:server
```

前端将运行在 `http://localhost:5173`，后端运行在 `http://localhost:3001`。

### 构建

```bash
# 类型检查并构建生产版本
pnpm build

# 预览生产构建
pnpm preview
```

### 代码检查

```bash
pnpm lint
```

## 设计亮点

- **Island 布局** — 清爽的卡片式设计，柔和灰色背景（`#F2F3F5`）搭配白色内容卡片
- **Apple Liquid Glass** — 可选的毛玻璃效果下拉菜单，配有背景模糊和渐变高光
- **设计令牌** — 统一的色彩体系：主色 `#4080FF`，文字层级 `#1F2329` / `#4E5969` / `#86909C`
- **自定义滚动条** — 极简的 macOS 风格滚动条样式
- **响应式面板** — 可折叠侧边栏、可展开服务器信息面板、可调节 SFTP 面板

## 开发路线

- [x] 真实 SSH 连接集成
- [x] 会话持久化与重连
- [x] 深色模式主题
- [x] SSH 密钥管理
- [x] 导出/导入服务器配置（云同步）
- [ ] 多语言支持（i18n）— 进行中
- [ ] 批量命令执行
- [ ] 认证与权限控制（RBAC）
- [ ] 审计日志
- [ ] 多用户支持

## 项目文档

- [项目概况与关键问题](./PROJECT_OVERVIEW.zh-CN.md) — 项目背景、架构介绍、可预见挑战与竞争分析

## 参与贡献

欢迎贡献代码！请随时提交 Pull Request。

## 开源协议

本项目基于 [MIT 协议](../LICENSE) 开源。
