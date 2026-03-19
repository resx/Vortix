<div align="center">

# Vortix

**A Modern SSH & Server Management Desktop App (Tauri + React)**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](./README.md) | [中文](./docs/README.zh-CN.md)

</div>

---

## Overview

Vortix is a cross-platform desktop app built with Tauri and React. It provides SSH terminal access, file management, monitoring, asset organization, and encrypted data sync. The Rust backend (Axum + SQLite) powers local APIs, terminal/SFTP transport, and sync.

## Features

- **SSH Terminal** - xterm.js-powered terminal with real-time I/O and key/password auth
- **SFTP File Manager** - Browse, upload, and download files from remote servers
- **Server Monitoring** - CPU, memory, disk, and network dashboards
- **Asset Management** - Folders, tags, and search for connections
- **Multi-Tab Workspace** - Tabbed sessions and split layouts
- **Settings & Profiles** - Theme, font, terminal behavior, SSH defaults
- **Encrypted Sync** - Local/Git/WebDAV/S3 sync with chunked manifest v4
- **SSH Key Store** - Generate/import/manage keys with encryption
- **Shortcut Commands** - Reusable command snippets
- **Theme System** - Light/dark UI and terminal themes
- **i18n** - Locale framework in progress

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **TypeScript 5.9** | Type safety |
| **Vite 7** | Build tooling |
| **Tailwind CSS 4** | Styling |
| **Zustand** | State management |
| **xterm.js** | Terminal emulator |
| **Recharts / Tremor** | Monitoring charts |
| **Framer Motion** | Animations |
| **Radix UI** | Accessible UI primitives |

### Backend (Rust / Tauri)

| Technology | Purpose |
|---|---|
| **Tauri 2** | Desktop runtime |
| **Rust** | Core backend |
| **Axum** | Local HTTP API |
| **Tokio** | Async runtime |
| **SQLx + SQLite** | Local data storage |
| **OpenDAL** | WebDAV/S3 storage |
| **gix (gitoxide)** | Git operations |
| **Rustls + reqwest** | TLS + HTTP client |
| **tracing** | Observability |

## Project Structure

```text
Vortix/
|- src/                      # React frontend
|- src-tauri/                # Rust backend + Tauri
|  |- src/server/            # Axum routes & handlers
|  |- src/sync/              # Sync engine (manifest + chunks)
|  |- src/db/                # SQLx + SQLite
|  `- src/crypto/            # Encryption utilities
|- docs/                     # Documentation
`- package.json
```

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **Rust** stable toolchain
- **pnpm**

### Development (Desktop)

```bash
pnpm tauri:dev
```

### Development (Web UI only)

```bash
pnpm dev
```

### Build

```bash
pnpm tauri:build
pnpm build
```

### Lint

```bash
pnpm lint
```
