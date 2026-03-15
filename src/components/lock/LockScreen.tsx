/* ── 锁屏组件 ── */

import { useState, useCallback, useEffect, useRef } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useUIStore } from '../../stores/useUIStore'

export default function LockScreen() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleUnlock = useCallback(() => {
    const lockPassword = useSettingsStore.getState().lockPassword
    if (password === lockPassword) {
      useUIStore.getState().setLocked(false)
      setPassword('')
      setError(false)
    } else {
      setError(true)
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
    }
  }, [password])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleUnlock()
  }, [handleUnlock])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-bg-base/95 backdrop-blur-xl select-none">
      <div className={`flex flex-col items-center gap-6 ${shaking ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <AppIcon icon={icons.lock} size={32} className="text-primary" />
        </div>

        <div className="text-center">
          <h2 className="text-[18px] font-semibold text-text-1 mb-1">Vortix 已锁定</h2>
          <p className="text-[12px] text-text-3">请输入密码解锁</p>
        </div>
        <div className="flex flex-col items-center gap-3 w-[280px]">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false) }}
            onKeyDown={handleKeyDown}
            placeholder="输入锁屏密码"
            className={`w-full h-[40px] px-4 rounded-lg bg-bg-card border text-[13px] text-text-1 placeholder-text-3 outline-none transition-colors ${
              error ? 'border-status-error' : 'border-border focus:border-primary'
            }`}
            autoComplete="off"
          />
          {error && (
            <span className="text-[11px] text-status-error">密码错误，请重试</span>
          )}
          <button
            onClick={handleUnlock}
            className="w-full h-[36px] rounded-lg bg-primary text-white text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            解锁
          </button>
        </div>
      </div>
    </div>
  )
}
