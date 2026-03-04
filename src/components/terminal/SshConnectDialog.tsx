import { useState, useEffect } from 'react'
import { X, Terminal, Eye, EyeOff, FolderOpen } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import * as api from '../../api/client'
import type { Folder } from '../../api/types'

export type DialogMode = 'quick' | 'save' | 'edit'

interface SshConnectDialogProps {
  open: boolean
  mode: DialogMode
  onClose: () => void
  /** 编辑模式下的初始数据 */
  initialData?: {
    id?: string
    name?: string
    folder_id?: string | null
    host?: string
    port?: number
    username?: string
    auth_method?: 'password' | 'key'
    remark?: string
  }
}

export default function SshConnectDialog({ open, mode, onClose, initialData }: SshConnectDialogProps) {
  const openQuickConnect = useAppStore((s) => s.openQuickConnect)
  const createConnectionAction = useAppStore((s) => s.createConnectionAction)
  const fetchAssets = useAppStore((s) => s.fetchAssets)

  const [name, setName] = useState('')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('root')
  const [authType, setAuthType] = useState<'password' | 'key'>('password')
  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [remark, setRemark] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [saving, setSaving] = useState(false)

  // 加载文件夹列表（save/edit 模式需要）
  useEffect(() => {
    if (open && mode !== 'quick') {
      api.getFolders().then(setFolders).catch(() => {})
    }
  }, [open, mode])

  // 编辑模式：填充初始数据
  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || '')
      setFolderId(initialData.folder_id ?? null)
      setHost(initialData.host || '')
      setPort(String(initialData.port || 22))
      setUsername(initialData.username || 'root')
      setAuthType(initialData.auth_method || 'password')
      setRemark(initialData.remark || '')
      setPassword('')
      setPrivateKey('')
    } else if (open) {
      // 重置表单
      setName('')
      setFolderId(null)
      setHost('')
      setPort('22')
      setUsername('root')
      setAuthType('password')
      setPassword('')
      setPrivateKey('')
      setRemark('')
    }
  }, [open, initialData])

  if (!open) return null

  const handleQuickConnect = () => {
    openQuickConnect({
      host,
      port: Number(port) || 22,
      username,
      ...(authType === 'password' ? { password } : { privateKey: privateKey }),
    })
    onClose()
  }

  const handleSave = async (andConnect: boolean) => {
    setSaving(true)
    try {
      await createConnectionAction({
        name: name || `${host}:${port}`,
        folder_id: folderId,
        host,
        port: Number(port) || 22,
        username,
        auth_method: authType,
        ...(authType === 'password' ? { password } : { private_key: privateKey }),
        remark,
      })
      if (andConnect) {
        openQuickConnect({
          host,
          port: Number(port) || 22,
          username,
          ...(authType === 'password' ? { password } : { privateKey: privateKey }),
        })
      }
      onClose()
    } catch (e) {
      console.error('保存连接失败', e)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!initialData?.id) return
    setSaving(true)
    try {
      await api.updateConnection(initialData.id, {
        name: name || `${host}:${port}`,
        folder_id: folderId,
        host,
        port: Number(port) || 22,
        username,
        auth_method: authType,
        ...(authType === 'password' && password ? { password } : {}),
        ...(authType === 'key' && privateKey ? { private_key: privateKey } : {}),
        remark,
      })
      await fetchAssets()
      onClose()
    } catch (e) {
      console.error('更新连接失败', e)
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'quick') {
      handleQuickConnect()
    } else if (mode === 'edit') {
      handleEdit()
    }
    // save 模式通过按钮分别处理
  }

  const title = mode === 'quick' ? '快速连接' : mode === 'save' ? '新建连接' : '编辑连接'
  const inputClass = 'w-full border border-border rounded px-3 py-2 text-[13px] text-text-1 placeholder-text-3 outline-none focus:border-primary transition-colors bg-bg-card'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-bg-card rounded-xl shadow-xl w-[480px] border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 text-text-1">
            <Terminal className="w-5 h-5" />
            <span className="font-medium text-[15px]">{title}</span>
          </div>
          <button onClick={onClose} className="text-text-3 hover:text-text-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 连接名称（save/edit 模式） */}
          {mode !== 'quick' && (
            <div>
              <label className="block text-[13px] text-text-2 mb-1">连接名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="可选，留空自动使用 host:port"
                className={inputClass}
              />
            </div>
          )}

          {/* 所属文件夹（save/edit 模式） */}
          {mode !== 'quick' && (
            <div>
              <label className="block text-[13px] text-text-2 mb-1">所属文件夹</label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-3" />
                <select
                  value={folderId || ''}
                  onChange={(e) => setFolderId(e.target.value || null)}
                  className={inputClass + ' pl-9 appearance-none cursor-pointer'}
                >
                  <option value="">无（根目录）</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* 主机 & 端口 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[13px] text-text-2 mb-1">主机地址</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.1 或 example.com"
                className={inputClass}
                required
                autoFocus
              />
            </div>
            <div className="w-24">
              <label className="block text-[13px] text-text-2 mb-1">端口</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* 用户名 */}
          <div>
            <label className="block text-[13px] text-text-2 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              className={inputClass}
              required
            />
          </div>

          {/* 认证方式 */}
          <div>
            <label className="block text-[13px] text-text-2 mb-1">认证方式</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`flex-1 py-1.5 rounded text-[13px] font-medium transition-colors ${
                  authType === 'password'
                    ? 'bg-primary text-white'
                    : 'bg-bg-base text-text-2 hover:bg-border'
                }`}
              >
                密码
              </button>
              <button
                type="button"
                onClick={() => setAuthType('key')}
                className={`flex-1 py-1.5 rounded text-[13px] font-medium transition-colors ${
                  authType === 'key'
                    ? 'bg-primary text-white'
                    : 'bg-bg-base text-text-2 hover:bg-border'
                }`}
              >
                私钥
              </button>
            </div>
          </div>

          {/* 密码 / 私钥 */}
          {authType === 'password' ? (
            <div>
              <label className="block text-[13px] text-text-2 mb-1">
                密码{mode === 'edit' ? '（留空保持不变）' : ''}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入密码"
                  className={inputClass + ' pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[13px] text-text-2 mb-1">
                私钥内容{mode === 'edit' ? '（留空保持不变）' : ''}
              </label>
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="粘贴 PEM 格式私钥"
                rows={4}
                className={inputClass + ' resize-none font-mono text-[12px]'}
              />
            </div>
          )}

          {/* 备注（save/edit 模式） */}
          {mode !== 'quick' && (
            <div>
              <label className="block text-[13px] text-text-2 mb-1">备注</label>
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="可选"
                className={inputClass}
              />
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-[13px] text-text-2 bg-bg-base hover:bg-border transition-colors"
            >
              取消
            </button>

            {mode === 'quick' && (
              <button
                type="submit"
                className="px-4 py-2 rounded text-[13px] text-white bg-primary hover:opacity-90 transition-colors"
              >
                连接
              </button>
            )}

            {mode === 'save' && (
              <>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded text-[13px] text-primary border border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  className="px-4 py-2 rounded text-[13px] text-white bg-primary hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  保存并连接
                </button>
              </>
            )}

            {mode === 'edit' && (
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded text-[13px] text-white bg-primary hover:opacity-90 transition-colors disabled:opacity-50"
              >
                保存
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
