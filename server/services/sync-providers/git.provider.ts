/* ── Git 同步 Provider ── */

import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { simpleGit, type SimpleGitOptions } from 'simple-git'
import type { SyncProvider, SyncFileInfo, GitProviderConfig } from './types.js'

const SYNC_FILENAME = 'vortix-sync.json'
const LEGACY_FILENAME = 'vortix-sync.dat'

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
  private getEnv(): { env: Record<string, string>; keyPath?: string } {
    const env: Record<string, string> = { ...process.env as Record<string, string> }
    let keyPath: string | undefined
    // TLS 验证控制
    if (!this.config.tlsVerify) {
      env.GIT_SSL_NO_VERIFY = 'true'
    }
    // SSH 私钥
    if (this.isSsh() && this.config.sshKey) {
      // 规范化密钥内容：统一 LF 换行 + 确保末尾换行
      let keyContent = this.config.sshKey.trim().replace(/\r\n/g, '\n')
      if (!keyContent.endsWith('\n')) keyContent += '\n'

      // 使用随机文件名防止冲突和预测
      keyPath = path.join(os.tmpdir(), `vortix-git-ssh-${crypto.randomUUID()}`)
      fs.writeFileSync(keyPath, keyContent, { mode: 0o600 })

      // Windows 路径需要用正斜杠，避免 SSH 解析反斜杠出错
      const sshKeyPath = keyPath.replace(/\\/g, '/')
      env.GIT_SSH_COMMAND = `ssh -i "${sshKeyPath}" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes`
    }
    return { env, keyPath }
  }

  /** 清理临时 SSH 密钥文件 */
  private cleanupKeyFile(keyPath?: string): void {
    if (keyPath) {
      try { fs.unlinkSync(keyPath) } catch { /* 静默 */ }
    }
  }

  /** 确保本地仓库就绪（clone 或 pull） */
  private async ensureRepo(): Promise<{ git: ReturnType<typeof simpleGit>; keyPath?: string }> {
    const { env, keyPath } = this.getEnv()
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
    // fetch + reset 代替 pull，兼容 force push 后的 diverged history
    try {
      await git.fetch('origin', branch)
      await git.reset(['--hard', `origin/${branch}`])
    } catch {
      // 空仓库或首次推送时可能失败，忽略
    }
    return { git, keyPath }
  }

  /** 通过 git ls-files 精确查找并移除非当前路径的旧同步文件 */
  private async cleanupOldSyncFiles(git: ReturnType<typeof simpleGit>): Promise<boolean> {
    let changed = false
    try {
      const result = await git.raw(['ls-files'])
      const tracked = result.trim().split('\n').filter(Boolean)
      for (const rel of tracked) {
        const basename = rel.split('/').pop()
        // 清理旧 .dat 文件和不在当前路径的 .json 文件
        const isLegacy = basename === LEGACY_FILENAME
        const isOldJson = basename === SYNC_FILENAME && rel !== this.syncRelPath
        if (!isLegacy && !isOldJson) continue
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
    const { git, keyPath } = await this.ensureRepo()
    try {
      // 清理旧位置的同步文件
      await this.cleanupOldSyncFiles(git)
      const filePath = path.join(this.workDir, this.syncRelPath)
      // 确保子目录存在
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, data)
      await git.add(this.syncRelPath)

      const branch = this.config.branch || 'master'
      const msg = `chore: vortix sync ${new Date().toISOString()}`

      // amend + force push，仓库只保留 1 个 commit
      let hasCommits = false
      try { await git.log({ maxCount: 1 }); hasCommits = true } catch { /* 空仓库 */ }

      if (hasCommits) {
        await git.commit(msg, { '--amend': null })
        await git.push('origin', branch, { '--force': null })
      } else {
        await git.commit(msg)
        await git.push('origin', branch)
      }
    } finally {
      this.cleanupKeyFile(keyPath)
    }
  }

  async download(): Promise<Buffer> {
    const { keyPath } = await this.ensureRepo()
    try {
      const filePath = path.join(this.workDir, this.syncRelPath)
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath)
      }
      // fallback: 尝试读取旧 .dat 文件
      const legacyRelPath = this.syncRelPath.replace(/\.json$/, '.dat')
      const legacyPath = path.join(this.workDir, legacyRelPath)
      if (fs.existsSync(legacyPath)) {
        return fs.readFileSync(legacyPath)
      }
      throw new Error('Git 仓库中不存在同步文件')
    } finally {
      this.cleanupKeyFile(keyPath)
    }
  }

  async delete(): Promise<void> {
    const { git, keyPath } = await this.ensureRepo()
    try {
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
        const branch = this.config.branch || 'master'
        // amend + force push，保持仓库只有 1 个 commit
        let hasCommits = false
        try { await git.log({ maxCount: 1 }); hasCommits = true } catch { /* */ }

        if (hasCommits) {
          await git.commit('chore: remove vortix sync data', { '--amend': null })
          await git.push('origin', branch, { '--force': null })
        } else {
          await git.commit('chore: remove vortix sync data')
          await git.push('origin', branch)
        }
      }
    } finally {
      this.cleanupKeyFile(keyPath)
    }
  }

  async status(): Promise<SyncFileInfo> {
    let keyPath: string | undefined
    try {
      const result = await this.ensureRepo()
      keyPath = result.keyPath
      // 优先检查新格式，fallback 旧格式
      const filePath = path.join(this.workDir, this.syncRelPath)
      const legacyRelPath = this.syncRelPath.replace(/\.json$/, '.dat')
      const legacyPath = path.join(this.workDir, legacyRelPath)
      for (const fp of [filePath, legacyPath]) {
        try {
          const stat = fs.statSync(fp)
          return { exists: true, lastModified: stat.mtime.toISOString(), size: stat.size }
        } catch { /* 继续 */ }
      }
      return { exists: false, lastModified: null, size: null }
    } catch {
      return { exists: false, lastModified: null, size: null }
    } finally {
      this.cleanupKeyFile(keyPath)
    }
  }

  async test(): Promise<void> {
    // 使用 git ls-remote 验证凭据和仓库地址，完全不碰本地工作目录
    const { env, keyPath } = this.getEnv()
    try {
      const remoteUrl = this.isSsh() ? this.config.url : this.getAuthUrl()
      const git = simpleGit()
      git.env(env)
      await git.listRemote([remoteUrl, 'HEAD'])
    } finally {
      this.cleanupKeyFile(keyPath)
    }
  }
}
