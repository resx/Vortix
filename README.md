<div align="center">

# Vortix

**A Modern Browser-Based SSH & Server Management Tool**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](./README.md) | [简体中文](./docs/README.zh-CN.md)

</div>

---

## Overview

Vortix is a sleek, browser-based SSH and server management platform. It combines a modern React SPA frontend with a Node.js WebSocket backend, enabling you to manage remote servers, transfer files, and monitor system resources — all from your browser.

## Screenshots

> Screenshots coming soon

## Features

- **SSH Terminal** — Full-featured terminal powered by xterm.js with WebSocket real-time communication, supporting password and private key authentication
- **SFTP File Manager** — Browse, upload, and download files on remote servers through an intuitive side panel
- **Server Monitoring** — Real-time dashboard displaying CPU, memory, disk, and network metrics with interactive charts
- **Asset Management** — Organize servers and connections with groups, tags, and a searchable asset tree
- **Multi-Tab Workspace** — Open multiple SSH sessions, asset lists, and monitors simultaneously in a tabbed interface
- **Settings Panel** — Configurable preferences including theme, font, terminal behavior, database connections, and SSH defaults
- **Context Menu** — Right-click context menus for quick actions on assets and tabs
- **Smooth Animations** — Polished transitions and interactions powered by Framer Motion

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **React 19** | UI framework with latest features |
| **TypeScript 5.9** | Type-safe development |
| **Vite 7** | Lightning-fast build tooling |
| **Tailwind CSS 4** | Utility-first styling with CSS-native `@theme` configuration |
| **Zustand** | Lightweight state management |
| **xterm.js** | Terminal emulator in the browser |
| **Recharts** | Data visualization for server monitoring |
| **Framer Motion** | Fluid animations and transitions |
| **Radix UI** | Accessible headless UI primitives (Dropdown, Select, Switch, Tooltip) |
| **Lucide React** | Beautiful, consistent icon set |

### Backend

| Technology | Purpose |
|---|---|
| **Node.js + Express 5** | HTTP server and REST API |
| **WebSocket (ws)** | Real-time bidirectional communication for terminal I/O |
| **ssh2** | SSH/SFTP protocol implementation |

## Project Structure

```
Vortix/
├── src/
│   ├── components/
│   │   ├── assets/          # Asset table, toolbar, shortcuts
│   │   ├── context-menu/    # Right-click context menus
│   │   ├── icons/           # Custom SVG icon components
│   │   ├── layout/          # Header, Sidebar, ActivityBar
│   │   ├── panels/          # ServerInfoPanel, SftpPanel
│   │   ├── settings/        # Settings panel and sub-pages
│   │   ├── tabs/            # TabBar, TerminalSimulation, ServerMonitor
│   │   ├── terminal/        # SSH terminal, connection dialog
│   │   └── ui/              # Reusable UI primitives (Input, Select, Switch...)
│   ├── stores/              # Zustand state stores
│   ├── data/                # Mock data
│   ├── lib/                 # Utility functions (cn helper)
│   ├── App.tsx              # Root application component
│   └── main.tsx             # Entry point
├── server/
│   └── ssh-server.ts        # Express + WebSocket SSH backend
├── docs/                    # Documentation
└── package.json
```

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **pnpm** (recommended package manager)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/vortix.git
cd vortix

# Install dependencies
pnpm install
```

### Development

```bash
# Start the frontend dev server
pnpm dev

# Start the SSH backend (in a separate terminal)
pnpm dev:server
```

The frontend will be available at `http://localhost:5173` and the backend at `http://localhost:3000`.

### Build

```bash
# Type-check and build for production
pnpm build

# Preview the production build
pnpm preview
```

### Lint

```bash
pnpm lint
```

## Design Highlights

- **Island Layout** — Clean card-based design with a soft gray background (`#F2F3F5`) and white content cards
- **Apple Liquid Glass** — Optional glass-effect dropdown menus with backdrop-blur and gradient highlights
- **Design Tokens** — Consistent color system: primary `#4080FF`, text hierarchy `#1F2329` / `#4E5969` / `#86909C`
- **Custom Scrollbars** — Minimal, macOS-style scrollbar styling
- **Responsive Panels** — Collapsible sidebar, expandable server info panel, and resizable SFTP panel

## Roadmap

- [ ] Real SSH connection integration (replacing terminal simulation)
- [ ] Session persistence and reconnection
- [ ] Multi-language support (i18n)
- [ ] Dark mode theme
- [ ] Batch command execution
- [ ] SSH key management
- [ ] Export/import server configurations

## Documentation

- [Project Overview & Key Issues](./docs/PROJECT_OVERVIEW.md) — Background, architecture, foreseeable challenges, and competitive analysis

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the [MIT License](LICENSE).
