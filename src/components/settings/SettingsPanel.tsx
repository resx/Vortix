import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import BasicSettings from './BasicSettings'
import SSHSettings from './SSHSettings'

const NAV_DATA = [
  { type: 'group', label: '通用' },
  { type: 'item', id: 'basic', label: '基础' },
  { type: 'item', id: 'ssh', label: 'SSH/SFTP' },
  { type: 'item', id: 'database', label: '数据库' },
  { type: 'solo', id: 'account', label: '账号', mt: true },
  { type: 'group', label: '快捷键', mt: true },
  { type: 'item', id: 'kb-basic', label: '基础' },
  { type: 'item', id: 'kb-ssh', label: 'SSH/SFTP' },
  { type: 'item', id: 'kb-database', label: '数据库' },
  { type: 'item', id: 'kb-docker', label: 'Docker' },
  { type: 'solo', id: 'storage', label: '储存仓库', mt: true },
  { type: 'solo', id: 'referral', label: '推介有奖', mt: true },
] as const

const CONTENT_MAP: Record<string, React.ComponentType> = {
  basic: BasicSettings,
  ssh: SSHSettings,
}

export default function SettingsPanel() {
  const toggleSettings = useAppStore((s) => s.toggleSettings)
  const [activeNav, setActiveNav] = useState('basic')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleSettings()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSettings])

  const ContentComponent = CONTENT_MAP[activeNav]

  return (
    <>
      {/* 遮罩 */}
      <motion.div
        className="fixed inset-0 z-[300] bg-black/20 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={toggleSettings}
      />

      {/* 面板 */}
      <motion.div
        className="fixed inset-0 z-[301] flex items-center justify-center pointer-events-none p-4"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div
          className="pointer-events-auto w-[1100px] max-w-[95vw] h-[720px] max-h-[95vh] bg-[#F2F3F5] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="h-[52px] flex items-center justify-between px-5 shrink-0 select-none bg-[#F2F3F5]">
            <span className="text-[#1F2329] font-medium text-[15px]">设置</span>
            <button
              className="text-[#86909C] hover:text-[#1F2329] hover:bg-[#E5E6EB] p-1.5 rounded-lg transition-colors"
              onClick={toggleSettings}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 flex overflow-hidden">
            {/* 左侧导航 */}
            <div className="w-[180px] flex flex-col py-2 overflow-y-auto custom-scrollbar shrink-0 select-none bg-[#F2F3F5]">
              {NAV_DATA.map((item, i) => {
                if (item.type === 'group') {
                  return (
                    <div key={i} className={`text-[12px] text-[#86909C] px-5 py-1.5 mb-1 font-medium ${'mt' in item && item.mt ? 'mt-3' : 'mt-1'}`}>
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
                        ? 'text-[#1F2329] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                        : 'text-[#4E5969] hover:bg-[#E5E6EB]/50'
                    }`}
                  >
                    {item.label}
                  </div>
                )
              })}
            </div>

            {/* 右侧内容 */}
            <div className="flex-1 bg-white rounded-tl-2xl shadow-[-4px_0_12px_rgba(0,0,0,0.02)] flex flex-col overflow-hidden relative">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-24">
                {ContentComponent ? <ContentComponent /> : (
                  <div className="flex items-center justify-center h-full text-[#86909C] text-[14px]">
                    即将推出
                  </div>
                )}
              </div>

              {/* 底部栏 */}
              <div className="absolute bottom-0 left-0 right-0 h-[64px] bg-white/90 backdrop-blur-md border-t border-[#E5E6EB] flex items-center justify-end px-8 gap-4 rounded-br-2xl z-10">
                <span className="text-[#86909C] text-[12px] mr-2">修改设置后如未生效，请重启页面或重启应用</span>
                <button className="px-5 py-2 bg-[#F2F3F5] text-[#4E5969] rounded-lg text-[13px] hover:bg-[#E5E6EB] transition-colors font-medium">
                  恢复默认
                </button>
                <button className="px-5 py-2 text-[#B5C7FF] rounded-lg text-[13px] font-medium pointer-events-none">
                  应用 (Ctrl+S)
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}
