import { useEffect, useMemo, useState } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import IslandModal from '../../ui/island-modal'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import * as api from '../../../api/client'
import type { Connection } from '../../../api/types'

export default function SelectAssetModal() {
  const toggleSubModal = useSshConfigStore((s) => s.toggleSubModal)
  const setField = useSshConfigStore((s) => s.setField)
  const jumpServerId = useSshConfigStore((s) => s.jumpServerId)

  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(jumpServerId)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await api.getConnections()
        if (!cancelled) {
          setConnections(rows.filter((row) => row.protocol === 'ssh'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return connections
    return connections.filter((item) => {
      return item.name.toLowerCase().includes(keyword)
        || item.host.toLowerCase().includes(keyword)
        || item.username.toLowerCase().includes(keyword)
    })
  }, [connections, search])

  const selected = filtered.find((item) => item.id === selectedId)
    ?? connections.find((item) => item.id === selectedId)
    ?? null

  const handleConfirm = () => {
    if (selected) {
      setField('jumpServerId', selected.id)
      setField('jumpServerName', `${selected.name} (${selected.host})`)
    }
    toggleSubModal('selectAsset', false)
  }

  return (
    <IslandModal
      title="选择跳板机"
      isOpen
      onClose={() => toggleSubModal('selectAsset', false)}
      width="max-w-[640px]"
      padding="p-0"
      footer={(
        <div className="w-full flex items-center justify-between">
          <span className="text-xs text-text-3">
            {selected ? `已选择: ${selected.name}` : '未选择跳板机'}
          </span>
          <button
            className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${
              selected
                ? 'bg-primary text-white hover:opacity-90'
                : 'bg-border text-text-3 cursor-not-allowed'
            }`}
            onClick={handleConfirm}
            disabled={!selected}
          >
            确定
          </button>
        </div>
      )}
    >
      <div className="h-[420px] flex flex-col">
        <div className="relative flex items-center gap-2 p-3 border-b border-border/50 bg-bg-card shrink-0">
          <div className="relative flex-1">
            <AppIcon icon={icons.search} size={14} className="absolute left-3 top-2 text-text-3" />
            <input
              type="text"
              placeholder="搜索名称、主机或用户名"
              className="w-full bg-bg-base border border-transparent rounded px-8 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-primary transition-all text-text-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-bg-card">
          {loading && (
            <div className="h-full flex items-center justify-center text-xs text-text-3">
              正在加载跳板机列表...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="h-full flex items-center justify-center text-xs text-text-3">
              未找到可用的 SSH 连接
            </div>
          )}

          {!loading && filtered.map((item) => {
            const isSelected = item.id === selectedId
            return (
              <button
                key={item.id}
                type="button"
                className={`w-full text-left rounded-lg px-3 py-2 mb-1 border transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent bg-bg-base hover:bg-bg-hover'
                }`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-sm truncate ${isSelected ? 'text-primary font-medium' : 'text-text-1'}`}>
                      {item.name}
                    </div>
                    <div className="text-xs text-text-3 truncate">
                      {item.username}@{item.host}:{item.port}
                    </div>
                  </div>
                  <AppIcon
                    icon={isSelected ? icons.check : icons.chevronRight}
                    size={14}
                    className={isSelected ? 'text-primary' : 'text-text-3'}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </IslandModal>
  )
}
