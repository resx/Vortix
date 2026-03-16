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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none animate-in fade-in duration-700 overflow-hidden">
      {/* 亚克力层 1：毛玻璃模糊（透明度低才能看到模糊效果） */}
      <div className="absolute inset-0 backdrop-blur-[40px] bg-[#1a1b1e]/40 pointer-events-none" />
      {/* 亚克力层 2：光照叠加 */}
      <div className="absolute inset-0 bg-white/[0.04] pointer-events-none" />

      <div className={`relative z-10 flex flex-col items-center gap-10 ${shaking ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
        <div className="w-24 h-24 rounded-[2.5rem] bg-white/[0.05] backdrop-blur-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border border-white/10 flex items-center justify-center transition-transform hover:scale-105 duration-500">
          <AppIcon icon={icons.lock} size={48} className="text-white/90 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
        </div>

        <div className="text-center">
          <h2 className="text-[28px] font-light text-white tracking-[0.2em] mb-3 uppercase">Locked</h2>
          <div className="h-1 w-12 bg-primary mx-auto rounded-full opacity-60" />
        </div>

        <div className="flex flex-col items-center gap-5 w-[320px]">
          <div className="w-full relative">
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false) }}
              onKeyDown={handleKeyDown}
              placeholder="Enter PIN"
              className={`w-full h-[48px] px-5 rounded-md bg-white/[0.03] border text-[15px] text-white placeholder-white/30 transition-all duration-300 backdrop-blur-md
                ${error ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 focus:border-primary/50 focus:bg-white/[0.08]'}
              `}
              autoComplete="off"
            />
            {error && (
              <span className="absolute -bottom-7 left-0 w-full text-center text-[12px] text-red-400 font-medium tracking-wide">
                Incorrect password. Please try again.
              </span>
            )}
          </div>

          <button
            onClick={handleUnlock}
            className="mt-4 w-full h-[44px] rounded-md bg-primary text-white text-[15px] font-bold hover:brightness-110 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] active:scale-95 transition-all uppercase tracking-widest"
          >
            Unlock System
          </button>
        </div>
      </div>
    </div>
  )
  }
