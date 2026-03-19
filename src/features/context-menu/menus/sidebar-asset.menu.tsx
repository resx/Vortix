import { registerMenu } from '../../../registries/context-menu.registry'
import { MenuItem, MenuDivider, ActionButton } from '../components/MenuParts'
import { NewConnectionSubmenu } from '../components/NewConnectionSubmenu'
import { useAssetStore } from '../../../stores/useAssetStore'
import { useTabStore } from '../../../stores/useTabStore'
import { useUIStore } from '../../../stores/useUIStore'
import { useToastStore } from '../../../stores/useToastStore'
import { icons } from '../../../components/icons/AppIcon'
import * as api from '../../../api/client'
import type { TreeItem } from '../../../types'
import { downloadJson, pickJsonFile, connClipboard, setConnClipboard } from '../menu-utils'

type ImportedConnection = {
  name?: string
  host?: string
  port?: number
  username?: string
  protocol?: string
  auth_method?: string
  remark?: string
  color_tag?: string
  folder_id?: string | null
}

function parseImportedConnections(data: unknown): ImportedConnection[] {
  const payload: unknown[] = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && 'connections' in data
      ? Array.isArray((data as { connections?: unknown }).connections)
        ? (data as { connections: unknown[] }).connections
        : [data]
      : [data]

  return payload.filter((item): item is ImportedConnection => typeof item === 'object' && item !== null)
}

/* ---- 注册资产侧边栏右键菜单 ---- */
export function registerSidebarAssetMenu(): () => void {
  return registerMenu({
    types: ['sidebar-asset', 'sidebar-blank-asset'],
    render: (ctx) => {
      const item = ctx.data as TreeItem | null
      const hideContextMenu = ctx.close

      const { fetchAssets, deleteFolderAction, deleteConnectionAction, renameFolderAction, renameConnectionAction, cloneConnectionAction, tableData } = useAssetStore.getState()
      const { tabs, openAssetTab, closeTab } = useTabStore.getState()
      const { setShowDirModal, openSshConfig, openLocalTermConfig, openBatchEdit } = useUIStore.getState()
      const { addToast } = useToastStore.getState()

      const isItem = ctx.type === 'sidebar-asset' && item
      const isConnection = isItem && item!.type === 'connection'
      const isFolder = isItem && item!.type === 'folder'
      const isLocal = isConnection && item!.protocol === 'local'

      // 查找该连接是否已打开标签页
      const connTab = isConnection ? tabs.find(t => t.connectionId === item!.id) : null
      const hasOpenTab = !!connTab
      // 查找 AssetRow 用于打开标签页
      const assetRow = isConnection ? tableData.find(r => r.id === item!.id) : null

      // 辅助操作
      const handleDelete = (id: string, type: 'folder' | 'connection' | 'asset') => {
        hideContextMenu()
        if (!confirm('确定要删除吗？此操作不可撤销。')) return
        if (type === 'folder') {
          deleteFolderAction(id)
        } else {
          deleteConnectionAction(id)
        }
      }

      const handleRename = (id: string, type: 'folder' | 'connection' | 'asset', currentName: string) => {
        hideContextMenu()
        const newName = prompt('请输入新名称', currentName)
        if (!newName || newName === currentName) return
        if (type === 'folder') {
          renameFolderAction(id, newName)
        } else {
          renameConnectionAction(id, newName)
        }
      }

      // 通用菜单项
      const newDirItem = <MenuItem icon={icons.folderPlus} label="新建目录" onClick={() => { hideContextMenu(); setShowDirModal(true) }} />
      const newConnItem = (
        <MenuItem icon={icons.link} label="新建连接" hasSubmenu>
          <div className="px-4 py-1 text-[11px] text-text-1 border-b border-border/50 mb-1">新建连接</div>
          <NewConnectionSubmenu onClose={hideContextMenu} />
        </MenuItem>
      )
      const refreshItem = <MenuItem icon={icons.refresh} label="刷新" onClick={() => { hideContextMenu(); fetchAssets() }} />

      if (isLocal) {
        // ── 本地终端右键菜单 ──
        return (
          <>
            <div className="px-4 py-1 text-[11px] text-text-1 font-medium">本地终端</div>
            <MenuItem icon={icons.squareX} label="关闭" disabled={!hasOpenTab} onClick={hasOpenTab ? () => { hideContextMenu(); closeTab(connTab!.id) } : undefined} />
            {newDirItem}
            {newConnItem}
            <MenuItem icon={icons.filePlus} label="新标签页打开" onClick={assetRow ? () => { hideContextMenu(); openAssetTab(assetRow) } : undefined} />
            <MenuDivider />
            <MenuItem icon={icons.edit} label="编辑" onClick={() => { hideContextMenu(); openLocalTermConfig('edit', item!.id) }} />
            <MenuItem icon={icons.copyPlus} label="克隆" onClick={() => { hideContextMenu(); cloneConnectionAction(item!.id) }} />
            <MenuItem icon={icons.fileX} label="删除" onClick={() => handleDelete(item!.id, 'connection')} />
            <MenuItem icon={icons.edit} label="重命名" onClick={() => handleRename(item!.id, 'connection', item!.name)} />
            {refreshItem}
          </>
        )
      }

      if (isConnection) {
        // ── SSH / 其他远程连接右键菜单 ──
        return (
          <>
            <div className="px-4 py-1 text-[11px] text-text-1 font-medium">SSH 连接</div>
            <MenuItem icon={icons.squareX} label="关闭" disabled={!hasOpenTab} onClick={hasOpenTab ? () => { hideContextMenu(); closeTab(connTab!.id) } : undefined} />
            {newDirItem}
            {newConnItem}
            <MenuItem icon={icons.filePlus} label="新标签页打开" onClick={assetRow ? () => { hideContextMenu(); openAssetTab(assetRow) } : undefined} />
            <MenuDivider />
            <MenuItem icon={icons.edit} label="编辑" onClick={() => { hideContextMenu(); openSshConfig('edit', item!.id) }} />
            <MenuItem icon={icons.fileEdit} label="批量编辑" onClick={() => { hideContextMenu(); openBatchEdit([item!.id]) }} />
            <MenuItem icon={icons.copyPlus} label="克隆" onClick={() => { hideContextMenu(); cloneConnectionAction(item!.id) }} />
            <MenuItem icon={icons.copy} label="复制 Host" onClick={() => { hideContextMenu(); const row = tableData.find(r => r.id === item!.id); if (row?.host) navigator.clipboard.writeText(row.host) }} />
            <MenuItem icon={icons.globe} label="通过服务器代理 Chrome" disabled onClick={() => { hideContextMenu(); addToast('info', 'Chrome 代理功能即将推出') }} />
            <MenuItem icon={icons.key} label="上传 SSH 公钥" onClick={() => { hideContextMenu(); api.getSshKeys().then(keys => { if (keys.length === 0) { addToast('error', '请先在密钥库中添加密钥'); return } const names = keys.map((k, i) => `${i + 1}. ${k.name}`).join('\n'); const idx = prompt(`选择要上传的公钥：\n${names}\n\n请输入序号`, '1'); if (!idx) return; const key = keys[parseInt(idx) - 1]; if (!key) { addToast('error', '无效的序号'); return } api.uploadSshKey(item!.id, key.id).then(r => addToast('success', r.message)).catch(e => addToast('error', (e as Error).message)) }) }} />
            <MenuItem icon={icons.fileX} label="删除" onClick={() => handleDelete(item!.id, 'connection')} />
            <MenuItem icon={icons.edit} label="重命名" onClick={() => handleRename(item!.id, 'connection', item!.name)} />
            {refreshItem}
            <MenuDivider />
            <MenuItem icon={icons.fileDown} label="导入" onClick={() => { hideContextMenu(); pickJsonFile().then(async (data) => { const conns = parseImportedConnections(data); let count = 0; for (const c of conns) { if (c.name && c.host) { await api.createConnection({ name: c.name, host: c.host, port: c.port, username: c.username ?? '', protocol: c.protocol, auth_method: c.auth_method, remark: c.remark, color_tag: c.color_tag, folder_id: c.folder_id }); count++ } } fetchAssets(); addToast('success', `成功导入 ${count} 条连接`) }).catch(() => {}) }} />
            <MenuItem icon={icons.fileUp} label="导出" onClick={() => { hideContextMenu(); api.getConnection(item!.id).then(conn => downloadJson({ connections: [conn] }, `connection-${conn.name}.json`)) }} />
          </>
        )
      }

      // ── 文件夹 / 空白区域右键菜单 ──
      return (
        <>
          <div className="flex items-center justify-between px-3 py-[4px] mb-1 border-b border-border/50">
            <span className="text-[11px] text-text-1 font-medium tracking-wide">操作</span>
            <div className="flex items-center bg-bg-base rounded border border-border p-[2px]">
              <ActionButton icon={icons.clipboard} tooltip="粘贴(Ctrl+V)" disabled={!connClipboard} onClick={connClipboard ? () => { hideContextMenu(); const cb = connClipboard!; const targetFolderId = isFolder ? item!.id : null; setConnClipboard(null); ;(async () => { for (const id of cb.ids) { if (cb.op === 'cut') { await api.updateConnection(id, { folder_id: targetFolderId }) } else { const conn = await api.getConnection(id); await api.createConnection({ name: conn.name + ' (副本)', host: conn.host, port: conn.protocol === 'local' ? undefined : conn.port, username: conn.username, protocol: conn.protocol, auth_method: conn.auth_method, remark: conn.remark, color_tag: conn.color_tag, folder_id: targetFolderId }) } } fetchAssets(); addToast('success', cb.op === 'cut' ? '已移动' : '已粘贴') })() } : undefined} />
              <div className="w-px h-3 bg-border mx-[1px]" />
              <ActionButton icon={icons.scissors} tooltip="剪切(Ctrl+X)" disabled={!isItem} onClick={isItem ? () => { hideContextMenu(); setConnClipboard({ ids: [item!.id], op: 'cut' }); addToast('success', '已剪切') } : undefined} />
              <div className="w-px h-3 bg-border mx-[1px]" />
              <ActionButton icon={icons.copy} tooltip="复制(Ctrl+C)" disabled={!isItem} onClick={isItem ? () => { hideContextMenu(); setConnClipboard({ ids: [item!.id], op: 'copy' }); addToast('success', '已复制') } : undefined} />
            </div>
          </div>
          {newDirItem}
          {newConnItem}
          {isFolder && <MenuItem icon={icons.link} label="批量打开" onClick={() => { hideContextMenu(); const children = item!.children ?? []; children.forEach(c => { if (c.type === 'connection') { const row = tableData.find(r => r.id === c.id); if (row) openAssetTab(row) } }) }} />}
          <MenuDivider />
          <MenuItem icon={icons.fileX} label="删除" disabled={!isFolder} onClick={isFolder ? () => handleDelete(item!.id, 'folder') : undefined} />
          <MenuItem icon={icons.edit} label="重命名" disabled={!isFolder} onClick={isFolder ? () => handleRename(item!.id, 'folder', item!.name) : undefined} />
          {refreshItem}
          <MenuDivider />
          <MenuItem icon={icons.fileDown} label="导入" onClick={() => { hideContextMenu(); pickJsonFile().then(async (data) => { const conns = parseImportedConnections(data); let count = 0; for (const c of conns) { if (c.name && c.host) { await api.createConnection({ name: c.name, host: c.host, port: c.port, username: c.username ?? '', protocol: c.protocol, auth_method: c.auth_method, remark: c.remark, color_tag: c.color_tag, folder_id: isFolder ? item!.id : null }); count++ } } fetchAssets(); addToast('success', `成功导入 ${count} 条连接`) }).catch(() => {}) }} />
          <MenuItem icon={icons.fileUp} label="导出" disabled={!isItem} onClick={isItem ? () => { hideContextMenu(); if (isFolder) { const children = item!.children ?? []; const connIds = children.filter(c => c.type === 'connection').map(c => c.id); Promise.all(connIds.map(id => api.getConnection(id))).then(conns => downloadJson({ connections: conns }, `folder-${item!.name}.json`)) } else { api.getConnection(item!.id).then(conn => downloadJson({ connections: [conn] }, `connection-${conn.name}.json`)) } } : undefined} />
        </>
      )
    },
  })
}
