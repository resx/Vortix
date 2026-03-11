/* ── 快速搜索对话框 ── */

import { useState, useEffect, useRef, useCallback } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { ProtocolIcon } from '../icons/ProtocolIcons'
import { motion, AnimatePresence } from 'framer-motion'
import { useAssetStore } from '../../stores/useAssetStore'
import { useUIStore } from '../../stores/useUIStore'
import { useTabStore } from '../../stores/useTabStore'
import { useT } from '../../i18n'

export default function QuickSearchDialog() {
  const open = useUIStore((s) => s.quickSearchOpen)
  const toggle = useUIStore((s) => s.toggleQuickSearch)
  const tableData = useAssetStore((s) => s.tableData)
  const openAssetTab = useTabStore((s) => s.openAssetTab)
  const t = useT()

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[999] flex items-start justify-center pt-[15vh]" onClick={toggle}>
      <AnimatePresence>
        <QuickSearchContent tableData={tableData} openAssetTab={openAssetTab} toggle={toggle} t={t} />
      </AnimatePresence>
    </div>
  )
}

function QuickSearchContent({
  tableData,
  openAssetTab,
  toggle,
  t,
}: {
  tableData: ReturnType<typeof useAssetStore.getState>['tableData']
  openAssetTab: ReturnType<typeof useTabStore.getState>['openAssetTab']
  toggle: ReturnType<typeof useUIStore.getState>['toggleQuickSearch']
  t: ReturnType<typeof useT>
}) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const assets = tableData.filter(r => r.type === 'asset')
  const filtered = query.trim()
    ? assets.filter(r => {
        const q = query.toLowerCase()
        return r.name.toLowerCase().includes(q)
          || r.host.toLowerCase().includes(q)
          || r.user.toLowerCase().includes(q)
      })
    : assets

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [])

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    setSelectedIdx(0)
  }, [])

  const handleSelect = useCallback((idx: number) => {
    const item = filtered[idx]
    if (item) {
      openAssetTab(item)
      toggle()
    }
  }, [filtered, openAssetTab, toggle])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(selectedIdx)
    } else if (e.key === 'Escape') {
      toggle()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="bg-bg-base rounded-xl shadow-2xl border border-border/60 w-[520px] flex flex-col overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
        <AppIcon icon={icons.search} size={16} className="text-text-3 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent text-[14px] text-text-1 outline-none placeholder-text-3"
          placeholder={t('dialog.quickSearch.placeholder')}
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={toggle} className="p-1 hover:bg-bg-hover rounded text-text-3 transition-colors">
          <AppIcon icon={icons.close} size={14} />
        </button>
      </div>

      <div className="max-h-[360px] overflow-y-auto custom-scrollbar p-1.5">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-text-3">
            {t('dialog.quickSearch.empty')}
          </div>
        ) : (
          filtered.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                idx === selectedIdx ? 'bg-primary/10 text-primary' : 'hover:bg-bg-hover text-text-1'
              }`}
              onClick={() => handleSelect(idx)}
              onMouseEnter={() => setSelectedIdx(idx)}
            >
              <ProtocolIcon protocol={item.protocol} size={15} className={idx === selectedIdx ? '!text-primary' : '!text-text-3'} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{item.name}</div>
                <div className="text-[11px] text-text-3 truncate">{item.user}@{item.host}</div>
              </div>
              {item.folderName && (
                <span className="text-[11px] text-text-3 bg-bg-subtle px-1.5 py-0.5 rounded shrink-0">{item.folderName}</span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 border-t border-border/60 flex items-center gap-4 text-[11px] text-text-3">
        <span><kbd className="bg-bg-subtle border border-border px-1 rounded">↑↓</kbd> 导航</span>
        <span><kbd className="bg-bg-subtle border border-border px-1 rounded">Enter</kbd> 打开</span>
        <span><kbd className="bg-bg-subtle border border-border px-1 rounded">Esc</kbd> 关闭</span>
      </div>
    </motion.div>
  )
}
