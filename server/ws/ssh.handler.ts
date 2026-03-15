/* ── WebSocket 终端处理（SSH + 本地 PTY + 高亮拦截器） ── */

import { WebSocketServer, WebSocket } from 'ws'
import { Client } from 'ssh2'
import type { IPty } from 'node-pty'
import type http from 'http'
import { createWriteStream, mkdirSync, type WriteStream } from 'fs'
import { join } from 'path'
import { HighlightInterceptor } from '../highlight-interceptor'
import type { HighlightConfig } from '../highlight-interceptor'
import { createLocalPty } from './local.handler'
import * as logRepo from '../repositories/log.repository.js'
import * as historyRepo from '../repositories/history.repository.js'
import * as settingsRepo from '../repositories/settings.repository.js'

/** ANSI 转义序列正则（用于日志清洗） */
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?(?:\x07|\x1b\\)|\x1b[()][0-9A-B]|\x1b[>=<]|\x1b\[[\?]?[0-9;]*[hlsr]/g

/** 终端日志写入器：缓冲 + 定时刷新，避免高频 I/O */
class TerminalLogger {
  private stream: WriteStream
  private buffer = ''
  private timer: ReturnType<typeof setInterval>
  private closed = false

  constructor(dir: string, connectionId: string, host: string) {
    mkdirSync(dir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const safeName = (connectionId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')
    const filePath = join(dir, `${safeName}_${ts}.log`)
    this.stream = createWriteStream(filePath, { flags: 'a', encoding: 'utf-8' })
    this.stream.write(`# Vortix Terminal Log\n# Host: ${host}\n# Started: ${new Date().toISOString()}\n\n`)
    // 每秒刷新一次缓冲区
    this.timer = setInterval(() => this.flush(), 1000)
  }

  /** 追加终端输出（去除 ANSI 转义） */
  append(data: string): void {
    if (this.closed) return
    this.buffer += data.replace(ANSI_RE, '')
    // 缓冲区超过 8KB 立即刷新
    if (this.buffer.length > 8192) this.flush()
  }

  private flush(): void {
    if (!this.buffer || this.closed) return
    this.stream.write(this.buffer)
    this.buffer = ''
  }

  destroy(): void {
    if (this.closed) return
    this.closed = true
    clearInterval(this.timer)
    this.flush()
    this.stream.write(`\n# Ended: ${new Date().toISOString()}\n`)
    this.stream.end()
  }
}

const ESC = '\\u001b'
const BRACKETED_PASTE_START_RE = new RegExp(`${ESC}\\[200~`, 'g')
const BRACKETED_PASTE_END_RE = new RegExp(`${ESC}\\[201~`, 'g')

export function setupWebSocket(_server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (ws: WebSocket) => {
    let sshClient: Client | null = null
    let sshStream: import('ssh2').ClientChannel | null = null
    let ptyProcess: IPty | null = null
    let highlightInterceptor: HighlightInterceptor | null = null
    let lastActivity = Date.now()
    let currentConnectionId: string | null = null
    let cmdBuffer = '' // 命令累积缓冲区
    let cachedHistoryEnabled: boolean | null = null // 缓存 sshHistoryEnabled 设置
    let termLogger: TerminalLogger | null = null // 终端日志录制

    // pwd 查询状态
    let pwdRequestId: string | null = null
    let pwdBuffer = ''
    let pwdSuppressUntil = 0  // pwd 完成后短暂抑制输出，避免 shell prompt 泄漏
    const PWD_MARKER_START = '__VORTIX_PWD_START__'
    const PWD_MARKER_END = '__VORTIX_PWD_END__'

    // 监控相关
    let monitorTimer: ReturnType<typeof setInterval> | null = null
    let prevCpuSample: number[] | null = null
    let prevNetSample: Record<string, [number, number]> | null = null
    let prevSampleTime = 0
    let cpuCoreCount = 1
    let prevPerCoreSamples: number[][] | null = null

    // 输出到前端的统一方法
    const sendOutput = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }))
      }
    }

    // 初始化或更新高亮拦截器
    const setupHighlight = (config: Partial<HighlightConfig>) => {
      if (!highlightInterceptor) {
        highlightInterceptor = new HighlightInterceptor(config)
        highlightInterceptor.on('data', sendOutput)
      } else {
        highlightInterceptor.updateConfig(config)
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'highlight-config-ack',
          data: { categories: highlightInterceptor.getCategories() },
        }))
      }
    }

    // 心跳检测（30 秒间隔）
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        if (Date.now() - lastActivity > 5 * 60 * 1000) {
          ws.send(JSON.stringify({ type: 'status', data: 'timeout' }))
          ws.close()
          return
        }
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)

    // 统一消息处理器（只注册一次）
    ws.on('message', async (raw: Buffer) => {
      let msg: { type: string; data?: unknown }
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }

      lastActivity = Date.now()
      if (msg.type === 'pong') return

      switch (msg.type) {
        case 'connect': {
          const data = msg.data as Record<string, unknown>

          // ── 本地终端分支 ──
          if (data.type === 'local') {
            try {
              ptyProcess = createLocalPty(ws, {
                shell: data.shell as string,
                workingDir: data.workingDir as string | undefined,
                initialCommand: data.initialCommand as string | undefined,
                cols: data.cols as number | undefined,
                rows: data.rows as number | undefined,
                highlightInterceptor,
              })
            } catch (err) {
              ws.send(JSON.stringify({ type: 'error', data: (err as Error).message }))
            }
            break
          }

          // ── SSH 连接分支 ──
          const { host, port, username, password, privateKey, passphrase, connectionId, cols, rows } = data as {
            host: string; port: number; username: string; password?: string; privateKey?: string; passphrase?: string; connectionId?: string; cols?: number; rows?: number
          }

          // 输入验证
          if (!host || typeof host !== 'string' || host.length > 255) {
            ws.send(JSON.stringify({ type: 'error', data: '无效的主机地址' }))
            break
          }
          if (!username || typeof username !== 'string' || username.length > 255) {
            ws.send(JSON.stringify({ type: 'error', data: '无效的用户名' }))
            break
          }
          const portNum = Number(port) || 22
          if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
            ws.send(JSON.stringify({ type: 'error', data: '端口号必须在 1-65535 之间' }))
            break
          }

          const shellCols = Number.isInteger(Number(cols)) ? Math.min(Math.max(Number(cols), 1), 500) : 120
          const shellRows = Number.isInteger(Number(rows)) ? Math.min(Math.max(Number(rows), 1), 200) : 30

          currentConnectionId = connectionId || null
          // 缓存历史记录设置，避免每次 Enter 都查询数据库
          try {
            cachedHistoryEnabled = settingsRepo.get('sshHistoryEnabled') !== false
          } catch { cachedHistoryEnabled = true }
          // 终端日志录制：读取 termLogDir，非空则启动
          try {
            const logDir = settingsRepo.get('termLogDir') as string
            if (logDir) termLogger = new TerminalLogger(logDir, connectionId || 'unknown', host)
          } catch { /* 日志初始化失败不影响连接 */ }
          sshClient = new Client()
          const connectStartTime = Date.now()

          sshClient.on('ready', () => {
            ws.send(JSON.stringify({ type: 'status', data: 'connected' }))

            // 写入连接日志
            if (currentConnectionId) {
              try {
                logRepo.create(currentConnectionId, 'connect', `${host}:${port}`, Date.now() - connectStartTime)
              } catch { /* 日志写入失败不影响连接 */ }
            }

            sshClient!.shell(
              { term: 'xterm-256color', cols: shellCols, rows: shellRows },
              (err, stream) => {
                if (err) {
                  ws.send(JSON.stringify({ type: 'error', data: err.message }))
                  return
                }

                sshStream = stream

                // SSH -> 前端（经过高亮拦截器，拦截 pwd 标记）
                stream.on('data', (chunk: Buffer) => {
                  let text = chunk.toString('utf-8')

                  // 拦截 pwd 查询结果
                  if (pwdRequestId) {
                    pwdBuffer += text
                    const startIdx = pwdBuffer.indexOf(PWD_MARKER_START)
                    const endIdx = pwdBuffer.indexOf(PWD_MARKER_END)
                    if (startIdx >= 0 && endIdx > startIdx) {
                      const path = pwdBuffer.substring(startIdx + PWD_MARKER_START.length, endIdx).trim()
                      if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'pwd-result', data: { requestId: pwdRequestId, path } }))
                      }
                      pwdRequestId = null
                      pwdBuffer = ''
                      // 设置 300ms 抑制窗口，丢弃 pwd 命令产生的后续 shell prompt
                      pwdSuppressUntil = Date.now() + 300
                      return
                    }
                    // 标记还没完整，继续缓冲，不转发
                    return
                  }

                  // pwd 完成后短暂抑制，丢弃延迟到达的 shell prompt
                  if (pwdSuppressUntil > 0 && Date.now() < pwdSuppressUntil) {
                    return
                  }
                  pwdSuppressUntil = 0

                  // 终端日志录制
                  termLogger?.append(text)

                  if (highlightInterceptor) {
                    highlightInterceptor.processChunk(text)
                  } else {
                    sendOutput(text)
                  }
                })

                stream.stderr.on('data', (chunk: Buffer) => {
                  const text = chunk.toString('utf-8')
                  termLogger?.append(text)
                  if (highlightInterceptor) {
                    highlightInterceptor.processChunk(text)
                  } else {
                    sendOutput(text)
                  }
                })

                stream.on('close', () => {
                  sshStream = null
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'status', data: 'closed' }))
                  }
                  ws.close()
                })
              },
            )
          })

          sshClient.on('error', (err) => {
            if (currentConnectionId) {
              try { logRepo.create(currentConnectionId, 'error', err.message) } catch { /* */ }
            }
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', data: err.message }))
            }
          })

          sshClient.on('close', () => {
            if (currentConnectionId) {
              try { logRepo.create(currentConnectionId, 'disconnect') } catch { /* */ }
            }
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'status', data: 'closed' }))
            }
          })

          const connectConfig: Record<string, unknown> = {
            host, port: portNum, username, readyTimeout: 10000,
          }
          if (privateKey) {
            connectConfig.privateKey = privateKey
            if (passphrase) connectConfig.passphrase = passphrase
          } else if (password) {
            connectConfig.password = password
          }

          sshClient.connect(connectConfig as Parameters<Client['connect']>[0])
          break
        }

        // 前端输入
        case 'input': {
          const inputData = msg.data as string
          if (typeof inputData !== 'string') break
          if (ptyProcess) ptyProcess.write(inputData)
          else if (sshStream) sshStream.write(inputData)

          // 命令历史记录：累积输入，检测 Enter 后持久化
          // 过滤 bracketed paste 转义序列
          const cleanInput = inputData.replace(BRACKETED_PASTE_START_RE, '').replace(BRACKETED_PASTE_END_RE, '')
          for (const ch of cleanInput) {
            if (ch === '\r' || ch === '\n') {
              const trimmed = cmdBuffer.trim()
              if (trimmed && currentConnectionId) {
                try {
                  if (cachedHistoryEnabled !== false) {
                    historyRepo.create(currentConnectionId, trimmed)
                  }
                } catch { /* 静默 */ }
              }
              cmdBuffer = ''
            } else if (ch === '\x7f' || ch === '\b') {
              // 退格：删除缓冲区末尾字符
              cmdBuffer = cmdBuffer.slice(0, -1)
            } else if (ch === '\x03') {
              // Ctrl+C：清空缓冲区
              cmdBuffer = ''
            } else if (ch === '\x15') {
              // Ctrl+U：清空行
              cmdBuffer = ''
            } else if (ch >= ' ' || ch === '\t') {
              cmdBuffer += ch
            }
          }
          break
        }

        // 终端尺寸调整
        case 'resize': {
          const { cols, rows } = msg.data as { cols: number; rows: number }
          // 验证 cols/rows 为正整数且在合理范围
          const c = Number(cols)
          const r = Number(rows)
          if (!Number.isInteger(c) || !Number.isInteger(r) || c < 1 || c > 500 || r < 1 || r > 200) break
          if (ptyProcess) ptyProcess.resize(c, r)
          else if (sshStream) sshStream.setWindow(r, c, 0, 0)
          break
        }

        // 获取 SSH 终端当前工作目录（用于路径联动）
        // 通过 sshStream 发送 marker 包裹的 pwd 命令，确保获取交互式 shell 的真实 cwd
        case 'pwd': {
          const reqId = (msg.data as { requestId?: string })?.requestId
          if (sshStream) {
            pwdRequestId = reqId || null
            pwdBuffer = ''
            // 使用 printf + hex 转义避免命令回显中出现标记字符串
            // 回显只包含 \x5f 字面文本，printf 输出才展开为真正的下划线标记
            sshStream.write(` printf '\\x5f\\x5fVORTIX_PWD_START\\x5f\\x5f%s\\x5f\\x5fVORTIX_PWD_END\\x5f\\x5f\\n' "$(pwd)"\n`)
          } else {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pwd-result', data: { requestId: reqId, path: null, error: '未连接' } }))
            }
          }
          break
        }

        // 高亮配置（可在连接前/后任意时刻接收）
        case 'highlight-config': {
          setupHighlight(msg.data as Partial<HighlightConfig>)
          break
        }

        // 断开连接
        case 'disconnect': {
          if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null }
          if (ptyProcess) { ptyProcess.kill(); ptyProcess = null }
          termLogger?.destroy(); termLogger = null
          sshStream = null
          sshClient?.end()
          sshClient = null
          break
        }

        // ── 监控采集 ──
        case 'monitor-start': {
          if (!sshClient || monitorTimer) break

          // 辅助：通过 SSH exec 执行命令并返回 stdout
          const sshExec = (cmd: string): Promise<string> => new Promise((resolve, reject) => {
            if (!sshClient) { reject(new Error('no client')); return }
            sshClient.exec(cmd, (err, stream) => {
              if (err) { reject(err); return }
              let out = ''
              stream.on('data', (chunk: Buffer) => { out += chunk.toString() })
              stream.stderr.on('data', () => {})
              stream.on('close', () => resolve(out))
            })
          })

          // 一次性系统信息采集
          try {
            const raw = await sshExec('uname -sr; echo "===SEP==="; hostname; echo "===SEP==="; whoami; echo "===SEP==="; cat /proc/uptime; echo "===SEP==="; nproc')
            const parts = raw.split('===SEP===').map(s => s.trim())
            const os = parts[0] || 'Linux'
            const host = parts[1] || 'unknown'
            const user = parts[2] || 'unknown'
            const uptimeSec = parseFloat(parts[3]?.split(' ')[0] || '0')
            cpuCoreCount = parseInt(parts[4] || '1', 10) || 1

            const days = Math.floor(uptimeSec / 86400)
            const hours = Math.floor((uptimeSec % 86400) / 3600)
            const mins = Math.floor((uptimeSec % 3600) / 60)
            const uptime = `${days}d ${hours}h ${mins}m`

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'monitor-info', data: { user, host, uptime, os } }))
            }
          } catch { /* 系统信息采集失败不影响后续 */ }

          // 定时采集（3s 间隔）
          const collectMonitor = async () => {
            if (!sshClient) return
            try {
              const cmd = [
                'cat /proc/stat',
                'echo "===SEP==="',
                'cat /proc/meminfo | grep -E "^(MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree):"',
                'echo "===SEP==="',
                'df -B1 2>/dev/null | tail -n +2',
                'echo "===SEP==="',
                'cat /proc/net/dev | tail -n +3',
                'echo "===SEP==="',
                'ps aux --sort=-%cpu 2>/dev/null | head -11',
              ].join('; ')

              const raw = await sshExec(cmd)
              const sections = raw.split('===SEP===').map(s => s.trim())
              const now = Date.now()

              // ── CPU 解析 ──
              const statLines = (sections[0] || '').split('\n')
              const cpuLine = statLines[0] || ''
              const cpuFields = cpuLine.replace(/^cpu\s+/, '').split(/\s+/).map(Number)
              // user, nice, system, idle, iowait, irq, softirq, steal
              const totalCpu = cpuFields.reduce((a, b) => a + b, 0)
              const system = cpuFields[2] || 0

              let cpuUsage = 0, cpuKernel = 0, cpuUser = 0, cpuIo = 0
              if (prevCpuSample) {
                const prevTotal = prevCpuSample.reduce((a, b) => a + b, 0)
                const dTotal = totalCpu - prevTotal
                const dIdle = (cpuFields[3] || 0) - (prevCpuSample[3] || 0) + (cpuFields[4] || 0) - (prevCpuSample[4] || 0)
                if (dTotal > 0) {
                  cpuUsage = +((1 - dIdle / dTotal) * 100).toFixed(1)
                  cpuKernel = +(((system - (prevCpuSample[2] || 0)) / dTotal) * 100).toFixed(1)
                  cpuUser = +((((cpuFields[0] || 0) - (prevCpuSample[0] || 0) + (cpuFields[1] || 0) - (prevCpuSample[1] || 0)) / dTotal) * 100).toFixed(1)
                  cpuIo = +((((cpuFields[4] || 0) - (prevCpuSample[4] || 0)) / dTotal) * 100).toFixed(1)
                }
              }
              prevCpuSample = cpuFields

              // 逐核 CPU
              const cpuPerCore: number[] = []
              const currentPerCore: number[][] = []
              for (let i = 1; i < statLines.length; i++) {
                const line = statLines[i]
                if (!line.match(/^cpu\d+/)) break
                const fields = line.replace(/^cpu\d+\s+/, '').split(/\s+/).map(Number)
                currentPerCore.push(fields)
                if (prevPerCoreSamples && prevPerCoreSamples[i - 1]) {
                  const prev = prevPerCoreSamples[i - 1]
                  const pTotal = prev.reduce((a, b) => a + b, 0)
                  const cTotal = fields.reduce((a, b) => a + b, 0)
                  const dt = cTotal - pTotal
                  const dI = (fields[3] || 0) - (prev[3] || 0) + (fields[4] || 0) - (prev[4] || 0)
                  cpuPerCore.push(dt > 0 ? +((1 - dI / dt) * 100).toFixed(0) : 0)
                } else {
                  cpuPerCore.push(0)
                }
              }
              prevPerCoreSamples = currentPerCore

              // ── 内存解析 ──
              const memMap: Record<string, number> = {}
              for (const line of (sections[1] || '').split('\n')) {
                const m = line.match(/^(\w+):\s+(\d+)/)
                if (m) memMap[m[1]] = parseInt(m[2], 10) // kB
              }
              const memTotal = +(((memMap['MemTotal'] || 0) / 1024).toFixed(1))
              const memAvailable = memMap['MemAvailable'] ?? (memMap['MemFree'] || 0) + (memMap['Buffers'] || 0) + (memMap['Cached'] || 0)
              const memUsed = +(((memMap['MemTotal'] || 0) - memAvailable) / 1024).toFixed(1)
              const swapTotal = +(((memMap['SwapTotal'] || 0) / 1024).toFixed(1))
              const swapUsed = +((((memMap['SwapTotal'] || 0) - (memMap['SwapFree'] || 0)) / 1024).toFixed(1))

              // ── 磁盘解析 ──
              const disks: { name: string; used: number; total: number; percent: number; path: string }[] = []
              for (const line of (sections[2] || '').split('\n')) {
                if (!line.trim()) continue
                const cols = line.split(/\s+/)
                if (cols.length < 6) continue
                const totalB = parseInt(cols[1], 10) || 0
                const usedB = parseInt(cols[2], 10) || 0
                if (totalB === 0) continue
                disks.push({
                  name: cols[0],
                  total: +(totalB / (1024 * 1024 * 1024)).toFixed(2),
                  used: +(usedB / (1024 * 1024 * 1024)).toFixed(2),
                  percent: Math.floor((usedB / totalB) * 100),
                  path: cols[5],
                })
              }

              // ── 网络解析 ──
              let netUp = 0, netDown = 0, netTotalUp = 0, netTotalDown = 0
              const nics: { name: string; ip: string; rxRate: number; txRate: number; rxTotal: number; txTotal: number }[] = []
              const currentNetSample: Record<string, [number, number]> = {}
              const elapsed = prevSampleTime > 0 ? (now - prevSampleTime) / 1000 : 3

              for (const line of (sections[3] || '').split('\n')) {
                if (!line.trim()) continue
                const m = line.match(/^\s*(\S+):\s*(\d+)(?:\s+\d+){7}\s+(\d+)/)
                if (!m) continue
                const name = m[1]
                const rx = parseInt(m[2], 10)
                const tx = parseInt(m[3], 10)
                currentNetSample[name] = [rx, tx]
                netTotalUp += tx
                netTotalDown += rx

                let rxRate = 0, txRate = 0
                if (prevNetSample && prevNetSample[name]) {
                  rxRate = +((rx - prevNetSample[name][0]) / elapsed / 1024).toFixed(1)
                  txRate = +((tx - prevNetSample[name][1]) / elapsed / 1024).toFixed(1)
                  if (rxRate < 0) rxRate = 0
                  if (txRate < 0) txRate = 0
                }
                netUp += txRate
                netDown += rxRate
                if (name !== 'lo') {
                  nics.push({ name, ip: '-', rxRate, txRate, rxTotal: rx, txTotal: tx })
                }
              }
              prevNetSample = currentNetSample
              prevSampleTime = now

              // ── 进程解析 ──
              const processes: { name: string; pid: number; cpu: string; mem: string }[] = []
              const psLines = (sections[4] || '').split('\n').slice(1) // 跳过表头
              for (const line of psLines) {
                if (!line.trim()) continue
                const cols = line.split(/\s+/)
                if (cols.length < 11) continue
                processes.push({
                  pid: parseInt(cols[1], 10),
                  cpu: cols[2] + '%',
                  mem: cols[3] + '%',
                  name: cols.slice(10).join(' ').split('/').pop()?.split(' ')[0] || cols[10],
                })
              }

              const snapshot = {
                cpuCores: cpuCoreCount,
                cpuUsage, cpuKernel, cpuUser, cpuIo,
                cpuPerCore,
                memUsed, memTotal, swapUsed, swapTotal,
                netUp: +netUp.toFixed(1),
                netDown: +netDown.toFixed(1),
                netTotalUp, netTotalDown,
                processes: processes.slice(0, 10),
                nics,
                disks,
              }

              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'monitor-data', data: snapshot }))
              }
            } catch { /* 采集失败静默跳过 */ }
          }

          // 立即采集一次，然后 3s 间隔
          collectMonitor()
          monitorTimer = setInterval(collectMonitor, 3000)
          break
        }

        case 'monitor-stop': {
          if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null }
          prevCpuSample = null
          prevNetSample = null
          prevPerCoreSamples = null
          prevSampleTime = 0
          break
        }
      }
    })

    ws.on('close', () => {
      clearInterval(heartbeatInterval)
      if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null }
      termLogger?.destroy(); termLogger = null
      highlightInterceptor?.destroy()
      highlightInterceptor = null
      if (ptyProcess) { ptyProcess.kill(); ptyProcess = null }
      sshStream = null
      sshClient?.end()
      sshClient = null
    })
  })

  return wss
}
