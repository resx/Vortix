import { useState } from 'react'
import { X, Terminal, Eye, EyeOff } from 'lucide-react'

interface SshConnectDialogProps {
  open: boolean
  onClose: () => void
  onConnect: (config: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
  }) => void
}

export default function SshConnectDialog({ open, onClose, onConnect }: SshConnectDialogProps) {
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('root')
  const [authType, setAuthType] = useState<'password' | 'key'>('password')
  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConnect({
      host,
      port: Number(port) || 22,
      username,
      ...(authType === 'password' ? { password } : { privateKey }),
    })
  }

  const inputClass = 'w-full border border-[#E5E6EB] rounded px-3 py-2 text-[13px] text-[#1F2329] placeholder-[#86909C] outline-none focus:border-[#4080FF] transition-colors bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-[440px] border border-[#E5E6EB] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E6EB]">
          <div className="flex items-center gap-2 text-[#1F2329]">
            <Terminal className="w-5 h-5" />
            <span className="font-medium text-[15px]">新建 SSH 连接</span>
          </div>
          <button onClick={onClose} className="text-[#86909C] hover:text-[#1F2329] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 主机 & 端口 */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[13px] text-[#4E5969] mb-1">主机地址</label>
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
              <label className="block text-[13px] text-[#4E5969] mb-1">端口</label>
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
            <label className="block text-[13px] text-[#4E5969] mb-1">用户名</label>
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
            <label className="block text-[13px] text-[#4E5969] mb-1">认证方式</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`flex-1 py-1.5 rounded text-[13px] font-medium transition-colors ${
                  authType === 'password'
                    ? 'bg-[#4080FF] text-white'
                    : 'bg-[#F2F3F5] text-[#4E5969] hover:bg-[#E5E6EB]'
                }`}
              >
                密码
              </button>
              <button
                type="button"
                onClick={() => setAuthType('key')}
                className={`flex-1 py-1.5 rounded text-[13px] font-medium transition-colors ${
                  authType === 'key'
                    ? 'bg-[#4080FF] text-white'
                    : 'bg-[#F2F3F5] text-[#4E5969] hover:bg-[#E5E6EB]'
                }`}
              >
                私钥
              </button>
            </div>
          </div>

          {/* 密码 / 私钥 */}
          {authType === 'password' ? (
            <div>
              <label className="block text-[13px] text-[#4E5969] mb-1">密码</label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86909C] hover:text-[#1F2329]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[13px] text-[#4E5969] mb-1">私钥内容</label>
              <textarea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="粘贴 PEM 格式私钥"
                rows={4}
                className={inputClass + ' resize-none font-mono text-[12px]'}
              />
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-[13px] text-[#4E5969] bg-[#F2F3F5] hover:bg-[#E5E6EB] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded text-[13px] text-white bg-[#4080FF] hover:bg-[#3070EE] transition-colors"
            >
              连接
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
