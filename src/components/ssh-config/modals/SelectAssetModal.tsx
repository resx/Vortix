import { useState } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import IslandModal from '../../ui/island-modal'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import { MOCK_ASSET_TREE } from '../../../data/ssh-config-mock'
import type { MockAssetNode } from '../../../data/ssh-config-mock'

export default function SelectAssetModal() {
  const toggleSubModal = useSshConfigStore((s) => s.toggleSubModal)
  const setField = useSshConfigStore((s) => s.setField)
  const [selected, setSelected] = useState<MockAssetNode | null>(null)
  const [search, setSearch] = useState('')

  const handleConfirm = () => {
    if (selected) {
      setField('jumpServerId', selected.name)
      setField('jumpServerName', `${selected.name} (${selected.ip})`)
    }
    toggleSubModal('selectAsset', false)
  }

  return (
    <IslandModal
      title="请选择资产"
      isOpen
      onClose={() => toggleSubModal('selectAsset', false)}
      width="max-w-[600px]"
      padding="p-0"
      footer={
        <div className="w-full flex items-center justify-between">
          <span className="text-xs text-text-3">已选择: {selected ? 1 : 0} 个</span>
          <button
            className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${selected ? 'bg-primary text-white hover:opacity-90' : 'bg-border text-text-3 cursor-not-allowed'}`}
            onClick={handleConfirm}
          >
            确定
          </button>
        </div>
      }
    >
      <div className="h-[360px] flex flex-col">
        {/* 搜索栏 */}
        <div className="relative flex items-center gap-2 p-3 border-b border-border/50 bg-bg-card shrink-0">
          <div className="relative flex-1">
            <AppIcon icon={icons.search} size={14} className="absolute left-3 top-2 text-text-3" />
            <input
              type="text"
              placeholder="搜索..."
              className="w-full bg-bg-base border border-transparent rounded px-8 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-primary transition-all text-text-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="p-1.5 text-text-3 hover:bg-bg-hover rounded transition-colors"><AppIcon icon={icons.folderPlus} size={16} /></button>
          <button className="p-1.5 text-text-3 hover:bg-bg-hover rounded transition-colors"><AppIcon icon={icons.copy} size={16} className="rotate-90" /></button>
        </div>

        {/* 树 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-bg-card">
          {MOCK_ASSET_TREE.map((node, i) => (
            <TreeNode key={i} node={node} selected={selected} onSelect={setSelected} search={search} />
          ))}
        </div>
      </div>
    </IslandModal>
  )
}

function TreeNode({
  node, level = 0, selected, onSelect, search,
}: {
  node: MockAssetNode; level?: number; selected: MockAssetNode | null; onSelect: (n: MockAssetNode) => void; search: string
}) {
  const [isOpen, setIsOpen] = useState(node.open !== false)
  const isSelected = selected?.name === node.name && selected?.ip === node.ip

  // 搜索过滤
  if (search && node.type === 'server' && !node.name.toLowerCase().includes(search.toLowerCase()) && !node.ip?.includes(search)) {
    return null
  }

  if (node.type === 'folder') {
    const filteredChildren = search
      ? node.children?.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.ip?.includes(search))
      : node.children

    if (search && (!filteredChildren || filteredChildren.length === 0)) return null

    return (
      <div className="w-full select-none">
        <div
          className="flex items-center px-2 py-1 hover:bg-bg-hover cursor-pointer text-xs text-text-1 rounded-md mx-1"
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="mr-1 text-text-3 w-4 flex justify-center">
            {isOpen ? <AppIcon icon={icons.chevronDown} size={14} /> : <AppIcon icon={icons.chevronRight} size={14} />}
          </div>
          <AppIcon icon={isOpen ? icons.folderOpenFill : icons.folderFill} size={15} className="mr-1.5 text-icon-folder" />
          {node.name}
        </div>
        {isOpen && node.children && (
          <div>
            {(filteredChildren ?? node.children).map((child, i) => (
              <TreeNode key={i} node={child} level={level + 1} selected={selected} onSelect={onSelect} search={search} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`flex items-center px-2 py-1 cursor-pointer text-xs select-none transition-colors rounded-md mx-1 mt-0.5 ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-bg-hover text-text-2'}`}
      style={{ paddingLeft: `${level * 16 + 28}px` }}
      onClick={() => onSelect(node)}
    >
      <AppIcon icon={icons.monitor} size={14} className={`mr-1.5 ${isSelected ? 'text-primary' : 'text-text-3'}`} />
      <span>{node.name}</span>
      {node.ip && <span className={`ml-4 text-[10px] ${isSelected ? 'text-primary/70' : 'text-text-3'}`}>{node.ip}</span>}
    </div>
  )
}
