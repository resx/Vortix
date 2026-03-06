/* ── 本地终端 PTY 处理器 ── */

import { spawn, type IPty } from 'node-pty'
import type { WebSocket } from 'ws'

export interface LocalPtyConfig {
  shell: string
  workingDir?: string
  initialCommand?: string
  cols?: number
  rows?: number
}

/** Shell 名称 → 可执行文件映射 */
const SHELL_MAP: Record<string, string> = {
  cmd: 'cmd.exe',
  bash: 'bash',
  powershell: 'powershell.exe',
  powershell7: 'pwsh.exe',
  wsl: 'wsl.exe',
  zsh: 'zsh',
  fish: 'fish',
}

/**
 * 创建本地 PTY 进程并绑定到 WebSocket
 * 返回 IPty 实例供外层管理生命周期
 */
export function createLocalPty(ws: WebSocket, config: LocalPtyConfig): IPty {
  const shellExe = SHELL_MAP[config.shell] || config.shell
  const cols = Math.max(config.cols || 120, 80)
  const rows = Math.max(config.rows || 30, 24)

  const ptyProcess = spawn(shellExe, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: config.workingDir || undefined,
  })

  // PTY 输出 → WebSocket
  ptyProcess.onData((data) => {
    if (ws.readyState === 1 /* WebSocket.OPEN */) {
      ws.send(JSON.stringify({ type: 'output', data }))
    }
  })

  // PTY 退出 → 通知前端
  ptyProcess.onExit(() => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'status', data: 'closed' }))
    }
  })

  // 通知前端已就绪
  ws.send(JSON.stringify({ type: 'status', data: 'connected' }))

  // 如果有初始命令，延迟写入
  if (config.initialCommand) {
    setTimeout(() => {
      ptyProcess.write(config.initialCommand + '\r')
    }, 300)
  }

  return ptyProcess
}
