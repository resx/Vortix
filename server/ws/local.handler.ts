/* ── 本地终端 PTY 处理器 ── */

import { spawn, type IPty } from 'node-pty'
import { existsSync, statSync } from 'fs'
import type { WebSocket } from 'ws'
import type { HighlightInterceptor } from '../highlight-interceptor'

export interface LocalPtyConfig {
  shell: string
  workingDir?: string
  initialCommand?: string
  cols?: number
  rows?: number
  highlightInterceptor?: HighlightInterceptor | null
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
  // Shell 白名单验证：不允许任意可执行文件
  const shellExe = SHELL_MAP[config.shell]
  if (!shellExe) {
    throw new Error(`不支持的 Shell 类型: ${config.shell}`)
  }

  // 验证工作目录存在且为目录
  if (config.workingDir) {
    try {
      if (!existsSync(config.workingDir) || !statSync(config.workingDir).isDirectory()) {
        throw new Error(`工作路径不存在或不是目录: ${config.workingDir}`)
      }
    } catch (e) {
      if ((e as Error).message.includes('工作路径')) throw e
      throw new Error(`无法访问工作路径: ${config.workingDir}`)
    }
  }

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
      if (config.highlightInterceptor) {
        config.highlightInterceptor.processChunk(data)
      } else {
        ws.send(JSON.stringify({ type: 'output', data }))
      }
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
