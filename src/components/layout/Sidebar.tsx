import { useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { icons } from '../icons/AppIcon'
import { useAssetStore } from '../../stores/useAssetStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useShortcutStore } from '../../stores/useShortcutStore'
import { useTabStore } from '../../stores/useTabStore'
import { useUIStore } from '../../stores/useUIStore'
import type { TreeItem } from '../../types'
import { NewAssetDropdown } from './sidebar/NewAssetDropdown'
import { SidebarHeaderButton } from './sidebar/SidebarHeaderButton'
import { FolderEyeIcon, FolderEyeOffIcon } from './sidebar/SidebarIcons'
import { SidebarTree } from './sidebar/SidebarTree'

export default function Sidebar() {
  const activeFilter = useAssetStore((s) => s.activeFilter)
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen)
  const assets = useAssetStore((s) => s.assets)
  const fetchAssets = useAssetStore((s) => s.fetchAssets)
  const isAssetLoading = useAssetStore((s) => s.isDataLoading)
  const shortcuts = useShortcutStore((s) => s.shortcuts)
  const fetchShortcuts = useShortcutStore((s) => s.fetchShortcuts)
  const toggleAssetFolder = useAssetStore((s) => s.toggleFolder)
  const expandAssetFolders = useAssetStore((s) => s.expandAllFolders)
  const collapseAssetFolders = useAssetStore((s) => s.collapseAllFolders)
  const toggleShortcutGroup = useShortcutStore((s) => s.toggleShortcutGroup)
  const expandShortcutGroups = useShortcutStore((s) => s.expandShortcutGroups)
  const collapseShortcutGroups = useShortcutStore((s) => s.collapseShortcutGroups)
  const showContextMenu = useUIStore((s) => s.showContextMenu)
  const openAssetTab = useTabStore((s) => s.openAssetTab)
  const currentFolder = useAssetStore((s) => s.currentFolder)
  const setCurrentFolder = useAssetStore((s) => s.setCurrentFolder)
  const moveConnectionToFolder = useAssetStore((s) => s.moveConnectionToFolder)
  const selectedItemId = useAssetStore((s) => s.selectedSidebarItemId)
  const setSelectedItemId = useAssetStore((s) => s.setSelectedSidebarItemId)
  const openShortcutDialog = useShortcutStore((s) => s.openShortcutDialog)
  const executeShortcut = useShortcutStore((s) => s.executeShortcut)
  const moveShortcutsToGroup = useShortcutStore((s) => s.moveShortcutsToGroup)
  const selectedShortcutIds = useShortcutStore((s) => s.selectedShortcutIds)
  const lastSelectedShortcutId = useShortcutStore((s) => s.lastSelectedShortcutId)
  const setShortcutSelection = useShortcutStore((s) => s.setShortcutSelection)
  const clearShortcutSelection = useShortcutStore((s) => s.clearShortcutSelection)
  const hideEmptyFolders = useSettingsStore((s) => s.hideEmptyFolders)
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const draggingShortcutIdsRef = useRef<string[]>([])
  const [isShortcutDragging, setIsShortcutDragging] = useState(false)
  const [draggingShortcutIds, setDraggingShortcutIds] = useState<string[]>([])
  const [shortcutDropTarget, setShortcutDropTarget] = useState<string | null>(null)
  const [isRefreshingList, setIsRefreshingList] = useState(false)

  const isShortcuts = activeFilter === 'shortcuts'
  const isAll = activeFilter === 'all'
  const isRefreshing = isRefreshingList || (!isShortcuts && isAssetLoading)
  const title = isShortcuts ? '快捷命令' : '资产列表'
  const data = isShortcuts ? shortcuts : assets
  const target = isShortcuts ? 'shortcuts' as const : 'assets' as const
  const disableHideEmptyFolders = isAll || isShortcuts
  const allExpanded = data.filter((i) => i.type === 'folder').every((i) => i.isOpen)

  const protocolMap: Record<string, string[]> = { ssh: ['ssh', 'sftp'], db: ['database'], docker: ['docker'] }
  const activeProtocols = protocolMap[activeFilter] ?? null
  const matchesFilter = (item: TreeItem) => (isAll || isShortcuts ? true : !!item.protocol && !!activeProtocols && activeProtocols.includes(item.protocol))
  const isFolderEmpty = (item: TreeItem) => (item.type !== 'folder' || !item.children ? true : isAll ? item.children.length === 0 : !item.children.some(matchesFilter))

  const filteredData = data.filter((item) => {
    if (item.type === 'connection') return matchesFilter(item)
    if (item.type === 'folder' && hideEmptyFolders && !disableHideEmptyFolders) return !isFolderEmpty(item)
    return true
  })

  const selectedShortcutIdSet = new Set(selectedShortcutIds)
  const draggingShortcutIdSet = new Set(draggingShortcutIds)
  const visibleShortcutOrder = isShortcuts
    ? filteredData.flatMap((item) => item.type === 'folder' ? (!item.isOpen ? [] : (item.children ?? []).filter(matchesFilter).map((child) => child.id)) : [item.id])
    : []

  const parseDraggedShortcutIds = (e: DragEvent, fallbackId?: string) => {
    if (draggingShortcutIdsRef.current.length > 0) return [...draggingShortcutIdsRef.current]
    const encoded = e.dataTransfer.getData('application/x-vortix-shortcut-ids')
    if (encoded?.trim()) {
      try {
        const parsed = JSON.parse(encoded)
        if (Array.isArray(parsed)) {
          const ids = parsed.map((v) => String(v)).filter(Boolean)
          if (ids.length > 0) return ids
        }
      } catch {
        // ignore malformed payload
      }
    }
    const single = e.dataTransfer.getData('text/connection-id')
    if (single?.trim()) return [single.trim()]
    const plain = e.dataTransfer.getData('text/plain')
    if (plain?.trim()) return [plain.trim()]
    return fallbackId ? [fallbackId] : []
  }

  const parseDraggedConnectionId = (e: DragEvent): string => {
    const typed = e.dataTransfer.getData('text/connection-id')
    if (typed?.trim()) return typed.trim()
    const plain = e.dataTransfer.getData('text/plain')
    return plain?.trim() ?? ''
  }

  const resetShortcutDragState = () => {
    draggingShortcutIdsRef.current = []
    setIsShortcutDragging(false)
    setDraggingShortcutIds([])
    setShortcutDropTarget(null)
  }

  const commitShortcutDrop = (e: DragEvent, targetGroupName: string) => {
    e.preventDefault()
    const ids = parseDraggedShortcutIds(e)
    if (ids.length > 0) void moveShortcutsToGroup(ids, targetGroupName)
    resetShortcutDragState()
  }

  const hydrateShortcutDragState = () => {
    if (isShortcutDragging) return
    const ids = [...draggingShortcutIdsRef.current]
    if (ids.length === 0) return
    setIsShortcutDragging(true)
    setDraggingShortcutIds(ids)
  }

  const handleShortcutClick = (e: MouseEvent, id: string) => {
    const isCtrlOrMeta = e.ctrlKey || e.metaKey
    const current = new Set(selectedShortcutIds)
    if (e.shiftKey && lastSelectedShortcutId && visibleShortcutOrder.length > 0) {
      const a = visibleShortcutOrder.indexOf(lastSelectedShortcutId)
      const b = visibleShortcutOrder.indexOf(id)
      if (a >= 0 && b >= 0) {
        const [start, end] = a < b ? [a, b] : [b, a]
        setShortcutSelection(visibleShortcutOrder.slice(start, end + 1), id)
      } else {
        setShortcutSelection([id], id)
      }
      setSelectedItemId(id)
      return
    }
    if (isCtrlOrMeta) {
      if (current.has(id)) current.delete(id)
      else current.add(id)
      setShortcutSelection([...current], id)
      setSelectedItemId(id)
      return
    }
    setShortcutSelection([id], id)
    setSelectedItemId(id)
  }

  const handleContextMenu = (e: MouseEvent, type: 'sidebar-blank-shortcut' | 'sidebar-shortcut' | 'sidebar-blank-asset' | 'sidebar-asset', item?: TreeItem) => {
    e.preventDefault()
    e.stopPropagation()
    showContextMenu(e.clientX, e.clientY, type, item ?? null)
  }

  const handleRefreshList = async () => {
    if (isRefreshing) return
    setIsRefreshingList(true)
    try {
      if (isShortcuts) await fetchShortcuts()
      else await fetchAssets()
    } finally {
      setIsRefreshingList(false)
    }
  }

  return (
    <div id="sidebar" className="bg-bg-card rounded-xl border border-border shadow-sm flex flex-col shrink-0 select-none transition-all duration-300 overflow-hidden" style={{ width: isSidebarOpen ? '270px' : '0px', opacity: isSidebarOpen ? 1 : 0 }}>
      <div className="w-[270px] flex flex-col h-full">
        <div id="sidebar-header" className="h-[40px] flex items-center justify-between px-3 border-b border-border shrink-0">
          <span className="text-[13px] font-bold text-text-1 tracking-wide">{title}</span>
          <div className="flex items-center gap-0.5 text-text-1">
            <SidebarHeaderButton icon={isRefreshing ? icons.loader : icons.refresh} tooltipText={isShortcuts ? '刷新快捷命令' : '刷新资产列表'} disabled={isRefreshing} onClick={() => { void handleRefreshList() }} />
            <SidebarHeaderButton icon={icons.search} tooltipText="搜索" />
            <SidebarHeaderButton icon={icons.crosshair} tooltipText="定位到选中项" />
            <SidebarHeaderButton
              icon={allExpanded ? icons.folder : icons.folderOpen}
              tooltipText={allExpanded ? '折叠所有' : '展开所有'}
              onClick={() => {
                if (allExpanded) {
                  if (isShortcuts) collapseShortcutGroups()
                  else collapseAssetFolders(target)
                } else if (isShortcuts) expandShortcutGroups()
                else expandAssetFolders(target)
              }}
            />
            <SidebarHeaderButton
              icon={hideEmptyFolders ? FolderEyeOffIcon : FolderEyeIcon}
              tooltipText={hideEmptyFolders ? '显示空文件夹' : '隐藏空文件夹'}
              disabled={disableHideEmptyFolders}
              onClick={() => updateSetting('hideEmptyFolders', !hideEmptyFolders)}
              className={hideEmptyFolders && !disableHideEmptyFolders ? 'bg-border text-text-1' : ''}
            />
            {isShortcuts ? <SidebarHeaderButton icon={icons.link} tooltipText="创建快捷命令" onClick={() => openShortcutDialog('create')} /> : <NewAssetDropdown />}
          </div>
        </div>

        <SidebarTree
          isShortcuts={isShortcuts}
          isShortcutDragging={isShortcutDragging}
          shortcutDropTarget={shortcutDropTarget}
          setShortcutDropTarget={setShortcutDropTarget}
          currentFolder={currentFolder}
          selectedItemId={selectedItemId}
          selectedShortcutIds={selectedShortcutIds}
          selectedShortcutIdSet={selectedShortcutIdSet}
          draggingShortcutIdSet={draggingShortcutIdSet}
          filteredData={filteredData}
          target={target}
          draggingShortcutIdsRef={draggingShortcutIdsRef}
          showRootShortcutDropHint={isShortcuts && isShortcutDragging}
          matchesFilter={matchesFilter}
          setCurrentFolder={setCurrentFolder}
          setSelectedItemId={setSelectedItemId}
          clearShortcutSelection={clearShortcutSelection}
          toggleShortcutGroup={toggleShortcutGroup}
          toggleAssetFolder={toggleAssetFolder}
          moveConnectionToFolder={moveConnectionToFolder}
          openAssetTab={openAssetTab}
          executeShortcut={executeShortcut}
          handleContextMenu={handleContextMenu}
          handleShortcutClick={handleShortcutClick}
          hydrateShortcutDragState={hydrateShortcutDragState}
          resetShortcutDragState={resetShortcutDragState}
          commitShortcutDrop={commitShortcutDrop}
          parseDraggedConnectionId={parseDraggedConnectionId}
        />
      </div>
    </div>
  )
}
