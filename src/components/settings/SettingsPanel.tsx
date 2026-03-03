import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Pin, Minus, Square, X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import BasicSettings from './BasicSettings'

const NAV_DATA = [
  { type: 'group', label: '通用' },
  { type: 'item', id: 'basic', label: '基础', active: true },
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

const windowIcons = [
  { Icon: Pin, label: '置顶', small: false },
  { Icon: Minus, label: '最小化', small: false },
  { Icon: Square, label: '最大化', small: true },
]

export default function SettingsPanel() {
  const toggleSettings = useAppStore((s) => s.toggleSettings)
  const [activeNav] = useState('basic')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleSettings()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSettings])

  return (
    <>
      {/* 遮罩 — 无模糊，纯淡色半透明，不阻断主窗口 */}
      <motion.div
        className="fixed inset-0 z-[300] bg-black/10"
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
          className="pointer-events-auto w-[960px] max-w-[95vw] h-[780px] max-h-[95vh] bg-[#F2F3F5] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — 与主窗口风格一致 */}
          <div className="h-[44px] flex items-center justify-between px-4 shrink-0 select-none bg-[#F2F3F5]">
            <span className="text-[#1F2329] font-medium text-[15px]">设置</span>

            {/* 窗口控制按钮 */}
            <div className="flex items-center gap-4 text-[#4E5969]">
              {windowIcons.map(({ Icon, label, small }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <button className="hover:text-[#1F2329] transition-colors">
                      <Icon className={small ? 'w-3 h-3' : 'w-[15px] h-[15px]'} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              ))}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleSettings}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="w-[15px] h-[15px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>关闭</TooltipContent>
              </Tooltip>
            </div>
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
                    className={`text-[13px] px-4 py-2 cursor-pointer transition-colors rounded-lg mx-3 mb-0.5 ${
                      'mt' in item && item.mt ? 'mt-2' : ''
                    } ${
                      isActive
                        ? 'text-[#1F2329] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] font-medium'
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
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pb-20">
                <BasicSettings />
              </div>

              {/* 底部栏 */}
              <div className="absolute bottom-0 left-0 right-0 h-[52px] bg-white/90 backdrop-blur-md border-t border-[#E5E6EB] flex items-center justify-end px-6 gap-4 rounded-br-2xl">
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
