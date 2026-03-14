import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { DEFAULT_PROFILE_ID } from '../../types/terminal-profile'

type HighlightKey = 'error' | 'warning' | 'ok' | 'info' | 'debug' | 'ipMac' | 'path' | 'url' | 'timestamp' | 'env'

const HIGHLIGHT_ITEMS: { key: HighlightKey; label: string; desc: string }[] = [
  { key: 'error', label: 'Error', desc: 'error, ERROR, fail, FAIL' },
  { key: 'warning', label: 'Warning', desc: 'warning, WARNING, warn' },
  { key: 'ok', label: 'OK', desc: 'ok, OK, success, SUCCESS' },
  { key: 'info', label: 'Info', desc: 'info, INFO' },
  { key: 'debug', label: 'Debug', desc: 'debug, DEBUG' },
  { key: 'ipMac', label: 'IP & MAC', desc: 'IP 地址、MAC 地址' },
  { key: 'path', label: '路径', desc: '/usr/bin, /etc/nginx' },
  { key: 'url', label: 'URL', desc: 'http://, https://' },
  { key: 'timestamp', label: '时间戳', desc: '2024-01-01 12:00:00' },
  { key: 'env', label: '环境变量', desc: '$HOME, ${PATH}' },
]

function ColorInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="relative w-[24px] h-[24px] rounded-md border border-border overflow-hidden cursor-pointer shrink-0">
        <div className="absolute inset-0" style={{ backgroundColor: value }} />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value.toUpperCase()
          if (/^#[0-9A-F]{0,6}$/.test(v)) onChange(v)
        }}
        className="w-[72px] h-[26px] border border-border bg-bg-base rounded px-2 text-[11px] text-text-1 font-mono outline-none focus:border-primary/50 transition-colors"
      />
    </div>
  )
}

export default function KeywordHighlightPanel({ profileId }: { profileId?: string }) {
  const profileStore = useTerminalProfileStore()
  const pid = profileId ?? DEFAULT_PROFILE_ID
  const profile = profileStore.getProfileById(pid) ?? profileStore.getDefaultProfile()
  const highlights = profile.keywordHighlights

  const handleChange = (key: HighlightKey, color: string) => {
    profileStore.updateProfile(pid, {
      keywordHighlights: { ...highlights, [key]: color },
    })
  }

  // 新增字段可能不存在于旧 profile 中，提供默认值
  const defaultColors: Record<string, string> = {
    path: '#D2B48C', url: '#00B4D8', timestamp: '#8B8682', env: '#61AFEF',
  }
  const getColor = (key: HighlightKey) => highlights[key] ?? defaultColors[key] ?? '#86909C'

  return (
    <div>
      <div className="text-[13px] font-medium text-text-1 mb-3">关键词高亮配色</div>
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-x-6 gap-y-3">
        {HIGHLIGHT_ITEMS.map(item => (
          <div key={item.key} className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[12px] text-text-1 font-medium">{item.label}</div>
              <div className="text-[10px] text-text-3 truncate">{item.desc}</div>
            </div>
            <ColorInput
              value={getColor(item.key)}
              onChange={(v) => handleChange(item.key, v)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
