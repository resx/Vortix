/* ── SFTP 服务：封装 ssh2 SFTPWrapper 为 Promise API ── */

import type { Client, SFTPWrapper } from 'ssh2'
import type { SftpFileEntry } from '../types/sftp.js'
import { EXEC_ALLOWED_COMMANDS } from '../types/sftp.js'
import path from 'path'

/** 将 ssh2 Stats 的 mode 转为 rwx 字符串 */
function modeToPermissions(mode: number): string {
  const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx']
  const owner = perms[(mode >> 6) & 7]
  const group = perms[(mode >> 3) & 7]
  const other = perms[mode & 7]
  return owner + group + other
}

/** 判断文件类型 */
function getFileType(attrs: { isDirectory(): boolean; isSymbolicLink(): boolean }): 'file' | 'dir' | 'symlink' {
  if (attrs.isSymbolicLink()) return 'symlink'
  if (attrs.isDirectory()) return 'dir'
  return 'file'
}

const DIR_SIZE_TTL_MS = 5 * 60 * 1000

export class SftpService {
  private sftp: SFTPWrapper | null = null
  private client: Client
  private dirSizeCache = new Map<string, { size: number; at: number }>()
  private dirSizeInFlight = new Map<string, Promise<number>>()

  constructor(client: Client) {
    this.client = client
  }

  /** 初始化 SFTP 子系统 */
  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.sftp((err, sftp) => {
        if (err) { reject(err); return }
        this.sftp = sftp
        resolve()
      })
    })
  }

  /** 获取 SFTP 实例（内部用） */
  private getSftp(): SFTPWrapper {
    if (!this.sftp) throw new Error('SFTP 未初始化')
    return this.sftp
  }

  /** 列出目录内容（不计算目录大小） */
  private async listDirRaw(dirPath: string): Promise<SftpFileEntry[]> {
    const sftp = this.getSftp()
    return new Promise((resolve, reject) => {
      sftp.readdir(dirPath, (err, list) => {
        if (err) { reject(err); return }
        const entries: SftpFileEntry[] = list.map((item) => ({
          name: item.filename,
          path: path.posix.join(dirPath, item.filename),
          type: getFileType(item.attrs),
          size: item.attrs.size,
          modifiedAt: new Date((item.attrs.mtime ?? 0) * 1000).toISOString(),
          permissions: modeToPermissions(item.attrs.mode & 0o777),
          owner: item.attrs.uid,
          group: item.attrs.gid,
        }))
        resolve(entries)
      })
    })
  }

  /** 递归统计目录大小（最佳努力，子目录不可访问则跳过） */
  private async getDirSizeRaw(dirPath: string, visited = new Set<string>()): Promise<number> {
    if (visited.has(dirPath)) return 0
    visited.add(dirPath)
    let total = 0
    const entries = await this.listDirRaw(dirPath)
    for (const entry of entries) {
      if (entry.type === 'dir') {
        try {
          total += await this.getDirSizeRaw(entry.path, visited)
        } catch {
          // 跳过不可访问子目录
        }
      } else {
        total += entry.size
      }
    }
    return total
  }

  private getCachedDirSize(dirPath: string): number | null {
    const cached = this.dirSizeCache.get(dirPath)
    if (!cached) return null
    if (Date.now() - cached.at > DIR_SIZE_TTL_MS) {
      this.dirSizeCache.delete(dirPath)
      return null
    }
    return cached.size
  }

  /** 递归统计目录大小（含缓存与去重） */
  async computeDirSize(dirPath: string): Promise<number> {
    const cached = this.getCachedDirSize(dirPath)
    if (cached !== null) return cached
    const inflight = this.dirSizeInFlight.get(dirPath)
    if (inflight) return inflight
    const task = this.getDirSizeRaw(dirPath, new Set<string>())
      .then((size) => {
        this.dirSizeCache.set(dirPath, { size, at: Date.now() })
        return size
      })
      .finally(() => {
        this.dirSizeInFlight.delete(dirPath)
      })
    this.dirSizeInFlight.set(dirPath, task)
    return task
  }

  /** 列出目录内容（目录大小懒计算） */
  async listDir(dirPath: string): Promise<SftpFileEntry[]> {
    const entries = await this.listDirRaw(dirPath)
    for (const entry of entries) {
      if (entry.type === 'dir') {
        const cached = this.getCachedDirSize(entry.path)
        entry.size = cached !== null ? cached : -1
      }
    }
    return entries
  }

  /** 创建目录 */
  async mkdir(dirPath: string): Promise<void> {
    const sftp = this.getSftp()
    return new Promise((resolve, reject) => {
      sftp.mkdir(dirPath, (err) => {
        if (err) { reject(err); return }
        resolve()
      })
    })
  }

  /** 重命名/移动 */
  async rename(oldPath: string, newPath: string): Promise<void> {
    const sftp = this.getSftp()
    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) { reject(err); return }
        resolve()
      })
    })
  }

  /** 删除文件 */
  async removeFile(filePath: string): Promise<void> {
    const sftp = this.getSftp()
    return new Promise((resolve, reject) => {
      sftp.unlink(filePath, (err) => {
        if (err) { reject(err); return }
        resolve()
      })
    })
  }

  /** 删除目录 */
  async removeDir(dirPath: string): Promise<void> {
    const sftp = this.getSftp()
    return new Promise((resolve, reject) => {
      sftp.rmdir(dirPath, (err) => {
        if (err) { reject(err); return }
        resolve()
      })
    })
  }

  /** 递归删除目录 */
  async removeDirRecursive(dirPath: string): Promise<void> {
    const entries = await this.listDir(dirPath)
    for (const entry of entries) {
      if (entry.type === 'dir') {
        await this.removeDirRecursive(entry.path)
      } else {
        await this.removeFile(entry.path)
      }
    }
    await this.removeDir(dirPath)
  }

  /** 获取文件/目录信息 */
  async stat(targetPath: string): Promise<SftpFileEntry> {
    const sftp = this.getSftp()
    return new Promise((resolve, reject) => {
      sftp.stat(targetPath, (err, stats) => {
        if (err) { reject(err); return }
        resolve({
          name: path.posix.basename(targetPath),
          path: targetPath,
          type: getFileType(stats),
          size: stats.size,
          modifiedAt: new Date((stats.mtime ?? 0) * 1000).toISOString(),
          permissions: modeToPermissions(stats.mode & 0o777),
          owner: stats.uid,
          group: stats.gid,
        })
      })
    })
  }

  /** 读取文件内容（文本） */
  async readFile(filePath: string, maxSize = 10 * 1024 * 1024): Promise<string> {
    const stats = await this.stat(filePath)
    if (stats.size > maxSize) {
      throw new Error(`文件过大（${(stats.size / 1024 / 1024).toFixed(1)}MB），最大允许 ${maxSize / 1024 / 1024}MB`)
    }
    const sftp = this.getSftp()
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const stream = sftp.createReadStream(filePath)
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      stream.on('error', reject)
    })
  }

  /** 写入文件内容（文本） */
  async writeFile(filePath: string, content: string): Promise<void> {
    const sftp = this.getSftp()
    return new Promise((resolve, reject) => {
      const stream = sftp.createWriteStream(filePath)
      stream.on('close', () => resolve())
      stream.on('error', reject)
      stream.end(Buffer.from(content, 'utf-8'))
    })
  }

  /** 创建可读流（用于下载） */
  createReadStream(filePath: string) {
    return this.getSftp().createReadStream(filePath)
  }

  /** 创建可写流（用于上传） */
  createWriteStream(filePath: string) {
    return this.getSftp().createWriteStream(filePath)
  }

  /** 获取用户 home 目录 */
  async realpath(targetPath: string): Promise<string> {
    const sftp = this.getSftp()
    return new Promise((resolve, reject) => {
      sftp.realpath(targetPath, (err, absPath) => {
        if (err) { reject(err); return }
        resolve(absPath)
      })
    })
  }

  /** 修改文件/目录权限 */
  async chmod(targetPath: string, mode: number): Promise<void> {
    const sftp = this.getSftp()
    return new Promise((resolve, reject) => {
      sftp.chmod(targetPath, mode, (err) => {
        if (err) { reject(err); return }
        resolve()
      })
    })
  }

  /** 递归修改权限（遍历目录树） */
  async chmodRecursive(targetPath: string, mode: number): Promise<void> {
    const stat = await this.stat(targetPath)
    await this.chmod(targetPath, mode)
    if (stat.type === 'dir') {
      const entries = await this.listDir(targetPath)
      for (const entry of entries) {
        if (entry.type === 'dir') {
          await this.chmodRecursive(entry.path, mode)
        } else {
          await this.chmod(entry.path, mode)
        }
      }
    }
  }

  /** 创建空文件（touch）或空目录 */
  async touch(targetPath: string, isDir = false): Promise<void> {
    if (isDir) {
      await this.mkdir(targetPath)
    } else {
      await this.writeFile(targetPath, '')
    }
  }

  /** 在远程 SSH 执行命令（白名单校验） */
  async exec(command: string): Promise<{ stdout: string; stderr: string; code: number }> {
    const trimmed = command.trim()
    const firstWord = trimmed.split(/\s+/)[0]
    const allowed = EXEC_ALLOWED_COMMANDS as readonly string[]
    if (!allowed.includes(firstWord)) {
      throw new Error(`命令 "${firstWord}" 不在白名单中，允许: ${allowed.join(', ')}`)
    }
    return new Promise((resolve, reject) => {
      this.client.exec(trimmed, (err, stream) => {
        if (err) { reject(err); return }
        let stdout = ''
        let stderr = ''
        stream.on('data', (data: Buffer) => { stdout += data.toString() })
        stream.stderr.on('data', (data: Buffer) => { stderr += data.toString() })
        stream.on('close', (code: number) => {
          resolve({ stdout, stderr, code: code ?? 0 })
        })
      })
    })
  }

  /** 销毁 SFTP 会话 */
  destroy(): void {
    if (this.sftp) {
      this.sftp.end()
      this.sftp = null
    }
  }
}
