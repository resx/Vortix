import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { AppIcon, icons } from '../icons/AppIcon'
import { useUIStore } from '../../stores/useUIStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { getSettingsEntries, getSettingsComponent } from '../../registries/settings-panel.registry'
import * as api from '../../api/client'
import type { SyncRequestBody } from '../../api/types'

/* ── 全息指令盒 Logo（与主 Header 一致） ── */

function GlitchBox({ size = 20 }: { size?: number }) {
  const fontSize = Math.round(size * 0.55)
  const scanLineSize = size <= 24 ? 2 : 4
  const isDark = document.documentElement.classList.contains('dark')
  return (
    <div
      className={`relative rounded-md flex items-center justify-center overflow-hidden flex-shrink-0 ${
        isDark
          ? 'bg-[#000] border border-gray-700 shadow-[0_0_12px_rgba(34,211,238,0.12)]'
          : 'bg-[#111] border border-gray-800 shadow-sm'
      }`}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 z-20 pointer-events-none opacity-40"
        style={{ background: `linear-gradient(transparent 50%, rgba(0,0,0,0.5) 50%)`, backgroundSize: `100% ${scanLineSize}px` }}
      />
      <div className="relative flex font-mono font-black tracking-tighter" style={{ fontSize: `${fontSize}px` }}>
        <span className="absolute text-cyan-400 -left-[1px] top-[1px] mix-blend-screen blur-[0.3px]" style={{ animation: 'holoFlicker 5s infinite' }}>
          &gt;<span style={{ animation: 'terminalBlink 2s step-end infinite' }}>_</span>
        </span>
        <span className="absolute text-rose-500 left-[1px] -top-[1px] mix-blend-screen blur-[0.3px]" style={{ animation: 'holoFlicker 5s infinite 150ms' }}>
          &gt;<span style={{ animation: 'terminalBlink 2s step-end infinite' }}>_</span>
        </span>
        <span className="relative z-10 text-white">
          &gt;<span style={{ animation: 'terminalBlink 2s step-end infinite', filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }}>_</span>
        </span>
      </div>
    </div>
  )
}

function SettingsLogoGroup() {
  return (
    <div className="flex items-center">
      <GlitchBox />
      <div className="flex flex-col ml-1.5 mt-0.5">
        <span
          className="text-text-1"
          style={{
            fontFamily: "'Chakra Petch', sans-serif",
            fontSize: '14px',
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          Vortix
        </span>
        <div className="h-[2px] w-full mt-1 relative overflow-hidden rounded-full bg-border/60">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-400/40 to-transparent" />
          <div className="absolute h-full w-6 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" style={{ animation: 'trackPulse 2.5s cubic-bezier(0.4,0,0.2,1) infinite' }} />
        </div>
      </div>
    </div>
  )
}

/* ── 窗口控制按钮 ── */

function WinBtn({ children, onClick, hoverClass = 'hover:bg-border' }: {
  children: React.ReactNode
  onClick?: () => void
  hoverClass?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-[28px] h-[28px] flex items-center justify-center rounded-md text-text-3 hover:text-text-1 transition-colors ${hoverClass}`}
    >
      {children}
    </button>
  )
}

/* ── 导航数据从注册表读取 ── */

/* ── 主组件 ── */

export default function SettingsPanel() {
  const toggleSettings = useUIStore((s) => s.toggleSettings)
  const settingsInitialNav = useUIStore((s) => s.settingsInitialNav)
  const setSettingsInitialNav = useUIStore((s) => s.setSettingsInitialNav)
  const dirty = useSettingsStore((s) => s._dirty)
  const applySettings = useSettingsStore((s) => s.applySettings)
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults)

  const [activeNav, setActiveNav] = useState(settingsInitialNav || 'basic')
  const [pinned, setPinned] = useState(false)
  const [syncTesting, setSyncTesting] = useState(false)
  const [syncTestResult, setSyncTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  /** 构建同步请求体 */
  const buildSyncBody = useCallback((): SyncRequestBody => {
    const s = useSettingsStore.getState()
    return {
      repoSource: s.syncRepoSource,
      encryptionKey: s.syncEncryptionKey || undefined,
      syncLocalPath: s.syncLocalPath,
      syncTlsVerify: s.syncTlsVerify,
      syncGitUrl: s.syncGitUrl, syncGitBranch: s.syncGitBranch,
      syncGitUsername: s.syncGitUsername, syncGitPassword: s.syncGitPassword,
      syncGitSshKey: s.syncGitSshKey,
      syncWebdavEndpoint: s.syncWebdavEndpoint, syncWebdavPath: s.syncWebdavPath,
      syncWebdavUsername: s.syncWebdavUsername, syncWebdavPassword: s.syncWebdavPassword,
      syncS3Style: s.syncS3Style, syncS3Endpoint: s.syncS3Endpoint,
      syncS3Path: s.syncS3Path, syncS3Region: s.syncS3Region,
      syncS3Bucket: s.syncS3Bucket, syncS3AccessKey: s.syncS3AccessKey,
      syncS3SecretKey: s.syncS3SecretKey,
    }
  }, [])

  /** 测试同步：导出一次验证连通性 */
  const handleTestSync = async () => {
    setSyncTesting(true); setSyncTestResult(null)
    try {
      await api.syncExport(buildSyncBody())
      setSyncTestResult({ ok: true, msg: '同步成功' })
    } catch (e) {
      setSyncTestResult({ ok: false, msg: (e as Error).message })
    } finally { setSyncTesting(false) }
    // 3 秒后清除结果
    setTimeout(() => setSyncTestResult(null), 4000)
  }
  const [maximized, setMaximized] = useState(false)
  const dragControls = useDragControls()
  const constraintRef = useRef<HTMLDivElement>(null)

  // 消费 settingsInitialNav
  useEffect(() => {
    if (settingsInitialNav) {
      setActiveNav(settingsInitialNav)
      setSettingsInitialNav(null)
    }
  }, [settingsInitialNav, setSettingsInitialNav])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleSettings()
      if (e.key === 's' && (e.ctrlKey || e.metaKey) && dirty) {
        e.preventDefault()
        applySettings()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSettings, dirty, applySettings])

  const navData = getSettingsEntries()
  const ContentComponent = getSettingsComponent(activeNav)
  const pinIcon = pinned ? icons.pinOff : icons.pin

  const panelSize = maximized
    ? 'w-full h-full max-w-full max-h-full rounded-none'
    : 'w-[1100px] max-w-[95vw] h-[720px] max-h-[95vh] rounded-2xl'

  return (
    <motion.div
      ref={constraintRef}
      className="fixed inset-0 z-[301] flex items-center justify-center pointer-events-none p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        drag={!maximized}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={constraintRef}
        dragMomentum={false}
        dragElastic={0}
        initial={{ scale: 0.96 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`pointer-events-auto ${panelSize} bg-bg-base shadow-[0_16px_48px_rgba(0,0,0,0.16),0_4px_12px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — 缩减版主 Header */}
        <div
          className="h-[48px] flex items-center px-4 shrink-0 select-none bg-bg-base cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            if (!(e.target as HTMLElement).closest('button')) dragControls.start(e)
          }}
        >
          {/* 左：Logo */}
          <div className="flex items-center w-[120px]">
            <SettingsLogoGroup />
          </div>

          {/* 中：标题 */}
          <div className="flex-1 text-center">
            <span className="text-text-1 font-medium text-[14px]">设置</span>
          </div>

          {/* 右：窗口控制 */}
          <div className="flex items-center gap-0.5 w-[120px] justify-end">
            <WinBtn onClick={() => setPinned(!pinned)}>
              <AppIcon icon={pinIcon} size={13} className={pinned ? 'text-primary' : ''} />
            </WinBtn>
            <WinBtn onClick={toggleSettings}>
              <AppIcon icon={icons.minimize} size={14} />
            </WinBtn>
            <WinBtn onClick={() => setMaximized(!maximized)}>
              <AppIcon icon={icons.maximize} size={12} />
            </WinBtn>
            <WinBtn onClick={toggleSettings} hoverClass="hover:bg-[#FEE2E2]">
              <AppIcon icon={icons.close} size={14} />
            </WinBtn>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧导航 */}
          <div className="w-[180px] flex flex-col py-2 overflow-y-auto custom-scrollbar shrink-0 select-none bg-bg-base">
            {navData.map((item, i) => {
              if (item.type === 'group') {
                return (
                  <div key={i} className={`text-[12px] text-text-3 px-5 py-1.5 mb-1 font-medium ${'mt' in item && item.mt ? 'mt-3' : 'mt-1'}`}>
                    {item.label}
                  </div>
                )
              }
              const isActive = 'id' in item && item.id === activeNav
              return (
                <div
                  key={i}
                  onClick={() => { if ('id' in item) setActiveNav(item.id) }}
                  className={`text-[13px] font-medium px-4 py-2 cursor-pointer transition-colors rounded-lg mx-3 mb-0.5 ${
                    'mt' in item && item.mt ? 'mt-2' : ''
                  } ${
                    isActive
                      ? 'text-text-1 bg-bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                      : 'text-text-2 hover:bg-border/50'
                  }`}
                >
                  {item.label}
                </div>
              )
            })}
          </div>

          {/* 右侧内容 */}
          <div className="flex-1 bg-bg-card rounded-tl-2xl shadow-[-4px_0_12px_rgba(0,0,0,0.02)] flex flex-col overflow-hidden relative">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-24">
              {ContentComponent ? <ContentComponent /> : (
                <div className="flex items-center justify-center h-full text-text-3 text-[14px]">
                  即将推出
                </div>
              )}
            </div>

            {/* 底部栏 */}
            <div className="absolute bottom-0 left-0 right-0 h-[64px] bg-bg-card/90 backdrop-blur-md border-t border-border flex items-center justify-end px-8 gap-4 rounded-br-2xl z-10">
              <span className="text-text-3 text-[12px] mr-2">修改设置后如未生效，请重启页面或重启应用</span>
              {activeNav === 'sync' && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={syncTesting}
                    onClick={handleTestSync}
                    className="flex items-center gap-1.5 px-5 py-2 bg-chart-green/15 text-chart-green rounded-lg text-[13px] hover:bg-chart-green/25 transition-colors font-medium disabled:opacity-50"
                  >
                    {syncTesting ? <AppIcon icon={icons.loader} size={14} className="animate-spin" /> : null}
                    {syncTesting ? '同步中...' : '测试同步'}
                  </button>
                  {syncTestResult && (
                    <span className={`flex items-center gap-1 text-[12px] ${syncTestResult.ok ? 'text-chart-green' : 'text-status-error'}`}>
                      {syncTestResult.ok ? <AppIcon icon={icons.checkCircle} size={13} /> : <AppIcon icon={icons.alertTriangle} size={13} />}
                      {syncTestResult.msg}
                    </span>
                  )}
                </div>
              )}
              <button
                className="px-5 py-2 bg-bg-base text-text-2 rounded-lg text-[13px] hover:bg-border transition-colors font-medium"
                onClick={resetToDefaults}
              >
                恢复默认
              </button>
              <button
                className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  dirty
                    ? 'bg-bg-active text-primary hover:opacity-90 cursor-pointer'
                    : 'bg-bg-base text-text-disabled cursor-not-allowed'
                }`}
                disabled={!dirty}
                onClick={applySettings}
              >
                应用 (Ctrl+S)
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
