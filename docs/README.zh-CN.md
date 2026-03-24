<div align="center">

# Vortix

**现代化 SSH 与服务器管理桌面应用（Tauri + React）**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg)](../LICENSE)

[English](../README.md) | [中文](./README.zh-CN.md)

</div>

---

## 概览

Vortix 是基于 Tauri + React 的跨平台桌面应用，提供 SSH 终端、文件管理、资源监控、资产管理与加密同步。Rust 后端（Axum + SQLite）负责本地 API、终端与 SFTP 传输以及同步能力。

## 功能

- **SSH 终端** - 基于 xterm.js 的实时终端，支持密码与密钥认证
- **SFTP 文件管理** - 浏览、上传和下载远程文件
- **服务器监控** - CPU、内存、磁盘和网络面板
- **资产管理** - 文件夹、标签和连接搜索
- **多标签工作区** - 标签与分栏布局
- **设置与配置** - 主题、字体、终端行为、SSH 默认值
- **加密同步** - 本地/Git/WebDAV/S3 同步，使用 v5 信封格式（导入兼容 v3/v4/legacy）
- **SSH 密钥管理** - 生成、导入和管理加密密钥
- **快捷命令** - 可复用命令片段
- **主题系统** - 明暗 UI 与终端主题
- **i18n** - 多语言框架仍在完善

## 技术栈

### 前端

| 技术 | 作用 |
|---|---|
| **React 19** | UI 框架 |
| **TypeScript 5.9** | 类型安全 |
| **Vite 7** | 构建工具 |
| **Tailwind CSS 4** | 样式系统 |
| **Zustand** | 状态管理 |
| **xterm.js** | 终端模拟器 |
| **Recharts / Tremor** | 监控图表 |
| **Framer Motion** | 动画 |
| **Radix UI** | 可访问性 UI 基础组件 |

### 后端（Rust / Tauri）

| 技术 | 作用 |
|---|---|
| **Tauri 2** | 桌面运行时 |
| **Rust** | 核心后端 |
| **Axum** | 本地 HTTP API |
| **Tokio** | 异步运行时 |
| **SQLx + SQLite** | 本地数据存储 |
| **OpenDAL** | WebDAV/S3 存储 |
| **gix (gitoxide)** | Git 操作 |
| **Rustls + reqwest** | TLS 与 HTTP 客户端 |
| **tracing** | 可观测性 |

## 项目结构

```text
Vortix/
|- src/                      # React 前端
|- src-tauri/                # Rust 后端 + Tauri
|  |- src/server/            # Axum 路由与处理器
|  |- src/sync/              # 同步引擎（v5 信封格式 + 旧版本导入兼容）
|  |- src/db/                # SQLx + SQLite
|  `- src/crypto/            # 加密工具
|- docs/                     # 文档
`- package.json
```

## 快速开始

### 前置要求

- **Node.js** >= 18
- **Rust** stable toolchain
- **pnpm**

### 桌面开发

```bash
pnpm tauri:dev
```

### 仅前端开发

```bash
pnpm dev
```

### 构建

```bash
pnpm tauri:build
pnpm build
```

### 检查

```bash
pnpm lint
```

## 开源协议

本项目采用 GNU General Public License v3.0 only（`GPL-3.0-only`）开源。
完整协议见 [LICENSE](../LICENSE)。
