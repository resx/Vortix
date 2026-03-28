import type { AuthType } from '../../../../stores/useSshConfigStore'

export const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-green-500', 'bg-cyan-500', 'bg-blue-500', 'bg-purple-500', 'bg-gray-500']

export const authTypes: { id: AuthType; label: string }[] = [
  { id: 'password', label: '密码' },
  { id: 'privateKey', label: '私钥' },
  { id: 'mfa', label: 'MFA/2FA' },
  { id: 'preset', label: '预设账号密码' },
  { id: 'jump', label: '跳板机私钥' },
  { id: 'agent', label: 'SSH Agent' },
  { id: 'none', label: '不验证' },
]

export const inputClass =
  'w-full bg-bg-base border border-transparent rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder-text-3 text-text-1'

export const labelClass = 'block text-xs text-text-2 mb-1.5'

export function errorInputClass(hasError: boolean) {
  return hasError
    ? 'w-full bg-bg-base border border-red-300 rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-red-400 focus:ring-1 focus:ring-red-300 transition-all placeholder-text-3 text-text-1'
    : inputClass
}
