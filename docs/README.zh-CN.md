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

- **SSH 终端** — 基于 xterm.js 的全功能终端，通过 WebSocket 实现实时通信，支持密码和私钥认证
- **SFTP 文件管理** — 通过直观的侧边面板浏览、上传和下载远程服务器文件
- **服务器监控** — 实时仪表盘，展示 CPU、内存、磁盘和网络指标，配有交互式图表
- **资产管理** — 通过分组、标签和可搜索的资产树来组织服务器和连接
- **多标签工作区** — 在标签页界面中同时打开多个 SSH 会话、资产列表和监控面板
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

## 项目结构

```
Vortix/
├── src/
│   ├── components/
│   │   ├── assets/          # 资产表格、工具栏、快捷方式
│   │   ├── context-menu/    # 右键上下文菜单
│   │   ├── icons/           # 自定义 SVG 图标组件
│   │   ├── layout/          # 顶栏、侧边栏、活动栏
│   │   ├── panels/          # 服务器信息面板、SFTP 面板
│   │   ├── settings/        # 设置面板及子页面
│   │   ├── tabs/            # 标签栏、终端模拟、服务器监控
│   │   ├── terminal/        # SSH 终端、连接对话框
│   │   └── ui/              # 可复用 UI 基础组件（输入框、选择器、开关…）
│   ├── stores/              # Zustand 状态仓库
│   ├── data/                # Mock 数据
│   ├── lib/                 # 工具函数（cn 辅助函数）
│   ├── App.tsx              # 根应用组件
│   └── main.tsx             # 入口文件
├── server/
│   └── ssh-server.ts        # Express + WebSocket SSH 后端服务
├── docs/                    # 项目文档
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

前端将运行在 `http://localhost:5173`，后端运行在 `http://localhost:3000`。

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

- [ ] 真实 SSH 连接集成（替换终端模拟）
- [ ] 会话持久化与重连
- [ ] 多语言支持（i18n）
- [ ] 深色模式主题
- [ ] 批量命令执行
- [ ] SSH 密钥管理
- [ ] 导出/导入服务器配置

## 项目文档

- [项目概况与关键问题](./PROJECT_OVERVIEW.zh-CN.md) — 项目背景、架构介绍、可预见挑战与竞争分析

## 参与贡献

欢迎贡献代码！请随时提交 Pull Request。

## 开源协议

本项目基于 [MIT 协议](../LICENSE) 开源。
