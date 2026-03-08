/* ── Git 同步 Provider ── */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { simpleGit, type SimpleGitOptions } from 'simple-git'
import type { SyncProvider, SyncFileInfo, GitProviderConfig } from './types.js'

const SYNC_FILENAME = 'vortix-sync.dat'

export class GitProvider implements SyncProvider {
  private config: GitProviderConfig
  private workDir: string
  /** 仓库内同步文件的相对路径 */
  private syncRelPath: string

  constructor(config: GitProviderConfig) {
    if (!config.url) throw new Error('Git 仓库地址不能为空')
    this.config = config
    const hash = Buffer.from(config.url).toString('base64url').slice(0, 16)
    this.workDir = path.join(os.tmpdir(), 'vortix-git-sync', hash)
    // 子目录：去除首尾斜杠
    const subDir = (config.path || '').replace(/^\/+|\/+$/g, '').replace(/\\+/g, '/')
    this.syncRelPath = subDir ? `${subDir}/${SYNC_FILENAME}` : SYNC_FILENAME
  }

  /** 构建认证 URL（HTTPS 模式） */
  private getAuthUrl(): string {
    const { url, username, password } = this.config
    if (!username && !password) return url
    try {
      const u = new URL(url)
      if (username) u.username = username
      if (password) u.password = password
      return u.toString()
    } catch {
      return url
    }
  }

  /** 判断是否 SSH 模式 */
  private isSsh(): boolean {
    const u = this.config.url.trim().toLowerCase()
    return u.startsWith('git@') || u.startsWith('ssh://')
  }

  /** 构建 git 环境变量 */
  private getEnv(): Record<string, string> {
    const env: Record<string, string> = { ...process.env as Record<string, string> }
    // TLS 验证控制
    if (!this.config.tlsVerify) {
      env.GIT_SSL_NO_VERIFY = 'true'
    }
    // SSH 私钥
    if (this.isSsh() && this.config.sshKey) {
      // 规范化密钥内容：统一 LF 换行 + 确保末尾换行
      let keyContent = this.config.sshKey.trim().replace(/\r\n/g, '\n')
      if (!keyContent.endsWith('\n')) keyContent += '\n'

      const keyPath = path.join(os.tmpdir(), 'vortix-git-ssh-key')
      fs.writeFileSync(keyPath, keyContent, { mode: 0o600 })

      // Windows 路径需要用正斜杠，避免 SSH 解析反斜杠出错
      const sshKeyPath = keyPath.replace(/\\/g, '/')
      env.GIT_SSH_COMMAND = `ssh -i "${sshKeyPath}" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes`
    }
    return env
  }

  /** 确保本地仓库就绪（clone 或 pull） */
  private async ensureRepo(): Promise<ReturnType<typeof simpleGit>> {
    const env = this.getEnv()
    const branch = this.config.branch || 'master'
    const opts: Partial<SimpleGitOptions> = { baseDir: this.workDir }

    if (!fs.existsSync(path.join(this.workDir, '.git'))) {
      // 首次 clone
      fs.mkdirSync(this.workDir, { recursive: true })
      const cloneUrl = this.isSsh() ? this.config.url : this.getAuthUrl()
      const tmpGit = simpleGit({ baseDir: os.tmpdir() })
      tmpGit.env(env)
      await tmpGit.clone(cloneUrl, this.workDir, ['--branch', branch, '--single-branch'])
    }

    const git = simpleGit(opts)
    git.env(env)
    // 拉取最新
    try {
      await git.pull('origin', branch)
    } catch {
      // 空仓库或首次推送时 pull 可能失败，忽略
    }
    return git
  }

  /** 通过 git ls-files 精确查找并移除非当前路径的旧同步文件 */
  private async cleanupOldSyncFiles(git: ReturnType<typeof simpleGit>): Promise<boolean> {
    let changed = false
    try {
      // 列出所有已跟踪文件，在 JS 侧过滤同步文件名
      const result = await git.raw(['ls-files'])
      const tracked = result.trim().split('\n').filter(Boolean)
      for (const rel of tracked) {
        // 只匹配文件名为 vortix-sync.dat 且不在当前路径的
        const basename = rel.split('/').pop()
        if (basename !== SYNC_FILENAME) continue
        if (rel === this.syncRelPath) continue
        const abs = path.join(this.workDir, rel)
        if (fs.existsSync(abs)) fs.unlinkSync(abs)
        await git.rm(rel)
        changed = true
      }
    } catch {
      // ls-files 失败（空仓库等），静默忽略
    }
    return changed
  }

  async upload(data: Buffer): Promise<void> {
    const git = await this.ensureRepo()
    // 清理旧位置的同步文件
    await this.cleanupOldSyncFiles(git)
    const filePath = path.join(this.workDir, this.syncRelPath)
    // 确保子目录存在
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, data)
    await git.add(this.syncRelPath)
    await git.commit(`chore: vortix sync ${new Date().toISOString()}`)
    await git.push('origin', this.config.branch || 'master')
  }

  async download(): Promise<Buffer> {
    await this.ensureRepo()
    const filePath = path.join(this.workDir, this.syncRelPath)
    if (!fs.existsSync(filePath)) {
      throw new Error('Git 仓库中不存在同步文件')
    }
    return fs.readFileSync(filePath)
  }

  async delete(): Promise<void> {
    const git = await this.ensureRepo()
    let hasChanges = false

    // 删除当前路径的同步文件
    const filePath = path.join(this.workDir, this.syncRelPath)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      await git.rm(this.syncRelPath)
      hasChanges = true
    }

    // 清理其他位置的旧同步文件
    if (await this.cleanupOldSyncFiles(git)) hasChanges = true

    if (hasChanges) {
      await git.commit(`chore: remove vortix sync data`)
      await git.push('origin', this.config.branch || 'master')
    }
  }

  async status(): Promise<SyncFileInfo> {
    try {
      await this.ensureRepo()
      const filePath = path.join(this.workDir, this.syncRelPath)
      const stat = fs.statSync(filePath)
      return {
        exists: true,
        lastModified: stat.mtime.toISOString(),
        size: stat.size,
      }
    } catch {
      return { exists: false, lastModified: null, size: null }
    }
  }
}
