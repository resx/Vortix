import type { ReactElement } from 'react'

export const inputClass =
  'w-full bg-bg-base border border-transparent rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder-text-3 text-text-1'
export const labelClass = 'block text-xs text-text-2 mb-1.5'
export const selectClass = `${inputClass} appearance-none cursor-pointer`
export const colors = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-400',
  'bg-green-500',
  'bg-cyan-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-gray-500',
]

export const chevronSvg: ReactElement = (
  <svg
    className="absolute right-2.5 top-2 text-text-3 pointer-events-none w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export type BatchTab = 'basic' | 'proxy' | 'env' | 'advanced'

export const TABS: { key: BatchTab; label: string }[] = [
  { key: 'basic', label: '基础' },
  { key: 'proxy', label: '代理' },
  { key: 'env', label: '环境变量' },
  { key: 'advanced', label: '高级' },
]

export const AUTH_TYPES = [
  { id: 'noChange', label: '不修改' },
  { id: 'password', label: '密码' },
  { id: 'privateKey', label: '私钥' },
  { id: 'mfa', label: 'MFA/2FA' },
  { id: 'preset', label: '预设账号密码' },
  { id: 'jump', label: '跳板机私钥' },
  { id: 'agent', label: 'SSH Agent' },
  { id: 'none', label: '不验证' },
]

export const PROXY_TYPES = ['关闭', '自动', 'SOCKS5', 'HTTP', 'HTTPS', 'SSH跳板']
export const ENCODINGS = ['UTF-8', 'GBK', 'GB2312', 'ASCII', 'US-ASCII', 'EUC-JP', 'EUC-KR', 'ISO-2022-JP']
export const TERM_TYPES = ['xterm-256color', 'xterm', 'xterm-16color', 'vt100', 'linux']

export const defaultAdvanced = {
  sftp: true,
  lrzsz: false,
  trzsz: false,
  sftpSudo: false,
  x11: false,
  terminalEnhance: true,
  pureTerminal: false,
  recordLog: false,
  x11Display: 'localhost:0',
  sftpCommand: '',
  heartbeat: '30',
  connectTimeout: '10',
  encoding: 'UTF-8',
  terminalType: 'xterm-256color',
  sftpDefaultPath: '',
  expireDate: '',
  initCommand: '',
}
