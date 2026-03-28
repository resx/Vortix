import type { DragEvent, MouseEvent, MutableRefObject } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { ProtocolIcon } from '../../icons/ProtocolIcons'
import { getColorTagTextClass } from '../../../lib/color-tag'
import type { TreeItem } from '../../../types'

interface SidebarTreeProps {
  isShortcuts: boolean
  isShortcutDragging: boolean
  shortcutDropTarget: string | null
  setShortcutDropTarget: (target: string | null) => void
  currentFolder: string | null
  selectedItemId: string | null
  selectedShortcutIds: string[]
  selectedShortcutIdSet: Set<string>
  draggingShortcutIdSet: Set<string>
  filteredData: TreeItem[]
  target: 'shortcuts' | 'assets'
  draggingShortcutIdsRef: MutableRefObject<string[]>
  showRootShortcutDropHint: boolean
  matchesFilter: (item: TreeItem) => boolean
  setCurrentFolder: (id: string | null) => void
  setSelectedItemId: (id: string | null) => void
  clearShortcutSelection: () => void
  toggleShortcutGroup: (id: string) => void
  toggleAssetFolder: (target: 'shortcuts' | 'assets', id: string) => void
  moveConnectionToFolder: (id: string, folderId: string | null) => void
  openAssetTab: (asset: { id: string; name: string; type: 'asset'; protocol?: string; latency: string; host: string; user: string; created: string; expire: string; remark: string }) => void
  executeShortcut: (command: string, mode: 'execute' | 'paste') => void
  handleContextMenu: (e: MouseEvent, type: 'sidebar-blank-shortcut' | 'sidebar-shortcut' | 'sidebar-blank-asset' | 'sidebar-asset', item?: TreeItem) => void
  handleShortcutClick: (e: MouseEvent, id: string) => void
  hydrateShortcutDragState: () => void
  resetShortcutDragState: () => void
  commitShortcutDrop: (e: DragEvent, targetGroupName: string) => void
  parseDraggedConnectionId: (e: DragEvent) => string
}

export function SidebarTree(props: SidebarTreeProps) {
  return (
    <div
      id="sidebar-tree"
      className={`flex-1 overflow-y-auto py-1.5 px-1 custom-scrollbar relative ${props.showRootShortcutDropHint ? 'ring-2 ring-primary/40 ring-inset bg-primary/5' : ''}`}
      onContextMenu={(e) => props.handleContextMenu(e, props.isShortcuts ? 'sidebar-blank-shortcut' : 'sidebar-blank-asset')}
      onDragEnter={(e) => {
        if (props.isShortcuts) {
          e.preventDefault(); e.dataTransfer.dropEffect = 'move'; props.hydrateShortcutDragState(); if (props.shortcutDropTarget !== 'root') props.setShortcutDropTarget('root'); return
        }
        e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-primary/30', 'ring-inset')
      }}
      onDragOver={(e) => {
        if (props.isShortcuts) {
          e.preventDefault(); e.dataTransfer.dropEffect = 'move'; props.hydrateShortcutDragState(); if (props.shortcutDropTarget !== 'root') props.setShortcutDropTarget('root'); return
        }
        e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-primary/30', 'ring-inset')
      }}
      onDragLeave={(e) => {
        if (props.isShortcuts) {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) props.setShortcutDropTarget(null)
          return
        }
        if (!e.currentTarget.contains(e.relatedTarget as Node)) e.currentTarget.classList.remove('ring-2', 'ring-primary/30', 'ring-inset')
      }}
      onDrop={(e) => {
        e.preventDefault(); e.currentTarget.classList.remove('ring-2', 'ring-primary/30', 'ring-inset')
        if (props.isShortcuts) { props.commitShortcutDrop(e, ''); return }
        const connectionId = props.parseDraggedConnectionId(e); if (connectionId) props.moveConnectionToFolder(connectionId, null)
      }}
    >
      {props.showRootShortcutDropHint && (
        <div className={`mx-1 mb-1 rounded-md border border-dashed px-2 py-1.5 text-[11px] transition-colors ${props.shortcutDropTarget === 'root' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-text-3'} pointer-events-none`}>
          拖到此处可移到根目录
        </div>
      )}

      {props.filteredData.map((item) => (
        <div key={item.id} className="flex flex-col">
          {item.type === 'folder' ? (
            <>
              <div
                className={`flex items-center px-1 py-1.5 rounded-md hover:bg-bg-hover cursor-pointer transition-colors
                  ${props.selectedItemId === item.id ? 'bg-primary/10 text-primary' : ''}
                  ${props.isShortcuts && props.isShortcutDragging && props.shortcutDropTarget === `group:${item.id}` ? 'ring-2 ring-primary/50 bg-primary/10' : ''}`}
                onClick={() => {
                  props.setSelectedItemId(item.id)
                  if (props.isShortcuts) props.clearShortcutSelection()
                  if (props.currentFolder !== item.id) props.setCurrentFolder(item.id)
                }}
                onDoubleClick={() => { if (props.isShortcuts) props.toggleShortcutGroup(item.id); else props.toggleAssetFolder(props.target, item.id) }}
                onContextMenu={(e) => props.handleContextMenu(e, props.isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', item)}
                onDragEnter={(e) => {
                  if (!props.isShortcuts) return
                  e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; props.hydrateShortcutDragState()
                  const next = `group:${item.id}`; if (props.shortcutDropTarget !== next) props.setShortcutDropTarget(next)
                }}
                onDragOver={(e) => {
                  if (props.isShortcuts) {
                    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; props.hydrateShortcutDragState()
                    const next = `group:${item.id}`; if (props.shortcutDropTarget !== next) props.setShortcutDropTarget(next); return
                  }
                  e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('ring-2', 'ring-primary/50')
                }}
                onDragLeave={(e) => {
                  if (props.isShortcuts) {
                    if (!e.currentTarget.contains(e.relatedTarget as Node) && props.shortcutDropTarget === `group:${item.id}`) props.setShortcutDropTarget(null)
                    return
                  }
                  e.currentTarget.classList.remove('ring-2', 'ring-primary/50')
                }}
                onDrop={(e) => {
                  if (props.isShortcuts) { e.stopPropagation(); props.commitShortcutDrop(e, item.groupName ?? item.name); return }
                  e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('ring-2', 'ring-primary/50')
                  const connectionId = props.parseDraggedConnectionId(e); if (connectionId) props.moveConnectionToFolder(connectionId, item.id)
                }}
              >
                <span className="w-4 flex justify-center text-text-3 cursor-pointer hover:text-text-1" onClick={(e) => { e.stopPropagation(); if (props.isShortcuts) props.toggleShortcutGroup(item.id); else props.toggleAssetFolder(props.target, item.id) }}>
                  {item.isOpen ? <AppIcon icon={icons.chevronDown} size={14} /> : <AppIcon icon={icons.chevronRight} size={14} />}
                </span>
                <span className="w-5 flex justify-center mr-1"><AppIcon icon={item.isOpen ? icons.folderOpenFill : icons.folderFill} size={15} className="text-icon-folder" /></span>
                <span className="text-[12px] text-text-2 truncate flex-1">{item.name}</span>
              </div>

              {item.isOpen && item.children?.filter(props.matchesFilter).map((child) => (
                <div
                  key={child.id}
                  className={`flex items-center px-1 py-1.5 pl-[36px] rounded-md hover:bg-bg-hover cursor-pointer transition-colors
                    ${(props.isShortcuts ? props.selectedShortcutIdSet.has(child.id) : props.selectedItemId === child.id) ? 'bg-primary/10 text-primary' : ''}
                    ${props.isShortcuts && props.draggingShortcutIdSet.has(child.id) ? 'opacity-60' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    if (props.isShortcuts) {
                      const ids = props.selectedShortcutIdSet.has(child.id) && props.selectedShortcutIds.length > 1 ? props.selectedShortcutIds : [child.id]
                      props.draggingShortcutIdsRef.current = ids
                      e.dataTransfer.setData('application/x-vortix-shortcut-ids', JSON.stringify(ids))
                      e.dataTransfer.setData('text/connection-id', ids[0] ?? child.id)
                      e.dataTransfer.setData('text/plain', ids[0] ?? child.id)
                      e.dataTransfer.effectAllowed = 'move'
                      return
                    }
                    e.dataTransfer.setData('text/connection-id', child.id); e.dataTransfer.setData('text/plain', child.id); e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnter={(e) => { if (!props.isShortcuts) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; props.hydrateShortcutDragState(); if (props.shortcutDropTarget !== 'root') props.setShortcutDropTarget('root') }}
                  onDragOver={(e) => { if (!props.isShortcuts) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; props.hydrateShortcutDragState(); if (props.shortcutDropTarget !== 'root') props.setShortcutDropTarget('root') }}
                  onClick={(e) => { if (props.isShortcuts) { props.handleShortcutClick(e, child.id); return } props.setSelectedItemId(child.id) }}
                  onDragEnd={() => { if (props.isShortcuts) props.resetShortcutDragState() }}
                  onContextMenu={(e) => props.handleContextMenu(e, props.isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', child)}
                  onDoubleClick={() => {
                    if (props.isShortcuts && child.command) props.executeShortcut(child.command, 'execute')
                    else if (child.type === 'connection') props.openAssetTab({ id: child.id, name: child.name, type: 'asset', protocol: child.protocol, latency: '-', host: '-', user: '-', created: '-', expire: '-', remark: '-' })
                  }}
                >
                  <span className="w-5 flex justify-center mr-1"><ProtocolIcon protocol={child.protocol} size={15} /></span>
                  <span className={`text-[12px] truncate flex-1 ${getColorTagTextClass(child.colorTag) || 'text-text-2'}`}>{child.name}</span>
                </div>
              ))}
            </>
          ) : (
            <div
              className={`flex items-center px-1 py-1.5 rounded-md hover:bg-bg-hover cursor-pointer transition-colors
                ${(props.isShortcuts ? props.selectedShortcutIdSet.has(item.id) : props.selectedItemId === item.id) ? 'bg-primary/10 text-primary' : ''}
                ${props.isShortcuts && props.draggingShortcutIdSet.has(item.id) ? 'opacity-60' : ''}`}
              draggable
              onDragStart={(e) => {
                if (props.isShortcuts) {
                  const ids = props.selectedShortcutIdSet.has(item.id) && props.selectedShortcutIds.length > 1 ? props.selectedShortcutIds : [item.id]
                  props.draggingShortcutIdsRef.current = ids
                  e.dataTransfer.setData('application/x-vortix-shortcut-ids', JSON.stringify(ids))
                  e.dataTransfer.setData('text/connection-id', ids[0] ?? item.id)
                  e.dataTransfer.setData('text/plain', ids[0] ?? item.id)
                  e.dataTransfer.effectAllowed = 'move'
                  return
                }
                e.dataTransfer.setData('text/connection-id', item.id); e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnter={(e) => { if (!props.isShortcuts) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; props.hydrateShortcutDragState(); if (props.shortcutDropTarget !== 'root') props.setShortcutDropTarget('root') }}
              onDragOver={(e) => { if (!props.isShortcuts) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; props.hydrateShortcutDragState(); if (props.shortcutDropTarget !== 'root') props.setShortcutDropTarget('root') }}
              onClick={(e) => { if (props.isShortcuts) { props.handleShortcutClick(e, item.id); return } props.setSelectedItemId(item.id) }}
              onDragEnd={() => { if (props.isShortcuts) props.resetShortcutDragState() }}
              onContextMenu={(e) => props.handleContextMenu(e, props.isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', item)}
              onDoubleClick={() => {
                if (props.isShortcuts && item.command) props.executeShortcut(item.command, 'execute')
                else props.openAssetTab({ id: item.id, name: item.name, type: 'asset', protocol: item.protocol, latency: '-', host: '-', user: '-', created: '-', expire: '-', remark: '-' })
              }}
            >
              <span className="w-4 flex justify-center" />
              <span className="w-5 flex justify-center mr-1"><ProtocolIcon protocol={item.protocol} size={15} /></span>
              <span className={`text-[12px] truncate flex-1 ${getColorTagTextClass(item.colorTag) || 'text-text-2'}`}>{item.name}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
