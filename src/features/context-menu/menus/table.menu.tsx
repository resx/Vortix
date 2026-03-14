import { registerMenu } from '../../../registries/context-menu.registry'
import { MenuItem, MenuDivider, ActionButton } from '../components/MenuParts'
import { NewConnectionSubmenu } from '../components/NewConnectionSubmenu'
import { icons } from '../../../components/icons/AppIcon'
import { useAssetStore } from '../../../stores/useAssetStore'
import { useTabStore } from '../../../stores/useTabStore'
import { useUIStore } from '../../../stores/useUIStore'
import { useToastStore } from '../../../stores/useToastStore'
import * as api from '../../../api/client'
import type { TableContextData, AssetRow } from '../../../types'
import { downloadJson, pickJsonFile, connClipboard, setConnClipboard } from '../menu-utils'
import { openConnectionInNewWindow } from '../../../lib/window'

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

export function registerTableMenu(): () => void {
  return registerMenu({
    types: ['table-context'],
    minWidth: 'min-w-[210px]',
    render(ctx) {
      const data = ctx.data as TableContextData | null
      const target = data?.targetContext || 'asset'
      const isBlank = target === 'blank'
      const isFolder = target === 'folder'
      const rowData = data?.rowData
      const currentFolderId = data?.currentFolderId

      const { fetchAssets, deleteFolderAction, deleteConnectionAction, renameFolderAction, renameConnectionAction, cloneConnectionAction, batchOpenSelected, selectedRowIds, tableData } = useAssetStore.getState()
      const { openAssetTab, openSplitTab } = useTabStore.getState()
      const { setShowDirModal, openSshConfig, openLocalTermConfig, openBatchEdit } = useUIStore.getState()
      const { addToast } = useToastStore.getState()

      const handleDelete = (id: string, type: 'folder' | 'connection' | 'asset') => {
        ctx.close()
        if (!confirm('确定要删除吗？此操作不可撤销。')) return
        if (type === 'folder') {
          deleteFolderAction(id)
        } else {
          deleteConnectionAction(id)
        }
      }
      const handleRename = (id: string, type: 'folder' | 'connection' | 'asset', currentName: string) => {
        ctx.close()
        const newName = prompt('请输入新名称', currentName)
        if (!newName || newName === currentName) return
        if (type === 'folder') {
          renameFolderAction(id, newName)
        } else {
          renameConnectionAction(id, newName)
        }
      }

      return (
        <>
          <div className="flex items-center justify-between px-3 py-[4px] mb-1 border-b border-border/50">
            <span className="text-[11px] text-text-1 font-medium tracking-wide">操作</span>
            <div className="flex items-center bg-bg-base rounded border border-border p-[2px]">
              <ActionButton icon={icons.clipboard} tooltip="粘贴(Ctrl+V)" disabled={!connClipboard} onClick={connClipboard ? () => { ctx.close(); const cb = connClipboard!; setConnClipboard(null); ;(async () => { for (const id of cb.ids) { if (cb.op === 'cut') { await api.updateConnection(id, { folder_id: null }) } else { const conn = await api.getConnection(id); await api.createConnection({ name: conn.name + ' (副本)', host: conn.host, port: conn.port, username: conn.username, protocol: conn.protocol, auth_method: conn.auth_method, remark: conn.remark, color_tag: conn.color_tag, folder_id: null }) } } fetchAssets(); addToast('success', cb.op === 'cut' ? '已移动' : '已粘贴') })() } : undefined} />
              <div className="w-px h-3 bg-border mx-[1px]" />
              <ActionButton icon={icons.scissors} tooltip="剪切(Ctrl+X)" disabled={isBlank} onClick={!isBlank && rowData ? () => { ctx.close(); setConnClipboard({ ids: selectedRowIds.size > 0 ? [...selectedRowIds] : [rowData.id], op: 'cut' }); addToast('success', '已剪切') } : undefined} />
              <div className="w-px h-3 bg-border mx-[1px]" />
              <ActionButton icon={icons.copy} tooltip="复制(Ctrl+C)" disabled={isBlank} onClick={!isBlank && rowData ? () => { ctx.close(); setConnClipboard({ ids: selectedRowIds.size > 0 ? [...selectedRowIds] : [rowData.id], op: 'copy' }); addToast('success', '已复制') } : undefined} />
            </div>
          </div>
          <MenuItem icon={icons.link} label="打开" shortcut="Enter" disabled={isBlank} onClick={rowData && !isBlank ? () => { ctx.close(); openAssetTab(rowData) } : undefined} />
          <MenuItem icon={icons.copyPlus} label="批量打开" disabled={isBlank} onClick={() => { ctx.close(); batchOpenSelected() }} />
          <MenuItem icon={icons.refresh} label="刷新" shortcut="F5" onClick={() => { ctx.close(); fetchAssets() }} />
          <MenuItem icon={icons.filePlus} label="新标签打开" shortcut="Alt+N" disabled={isBlank || isFolder} onClick={rowData && !isBlank && !isFolder ? () => { ctx.close(); openAssetTab(rowData) } : undefined} />
          <MenuItem icon={icons.externalLink} label="新窗口打开" shortcut="Ctrl+Shift+N" disabled={isBlank || isFolder} onClick={rowData && !isBlank && !isFolder ? () => { ctx.close(); openConnectionInNewWindow(rowData.id) } : undefined} />
          <MenuItem icon={icons.columns} label="同屏打开" disabled={isBlank || isFolder} onClick={!isBlank && !isFolder ? () => { ctx.close(); const rows: AssetRow[] = []; if (selectedRowIds.size > 0) { for (const id of selectedRowIds) { const r = tableData.find(row => row.id === id && row.type === 'asset'); if (r) rows.push(r) } } else if (rowData && rowData.type === 'asset') { rows.push(rowData) } if (rows.length > 0) openSplitTab(rows) } : undefined} />
          <MenuDivider />
          <MenuItem icon={icons.copy} label="克隆" disabled={isBlank || isFolder} onClick={rowData && !isBlank && !isFolder ? () => { ctx.close(); cloneConnectionAction(rowData.id) } : undefined} />
          <MenuItem icon={icons.folderPlus} label="新建目录" onClick={() => { ctx.close(); setShowDirModal(true) }} />
          <MenuItem icon={icons.link} label="新建连接" hasSubmenu>
            <div className="px-4 py-1 text-[11px] text-text-1 border-b border-border/50 mb-1">新建连接</div>
            <NewConnectionSubmenu onClose={() => ctx.close()} />
          </MenuItem>
          <MenuItem icon={icons.edit} label="编辑" disabled={isBlank || isFolder} onClick={rowData && !isBlank && !isFolder ? () => { ctx.close(); if (rowData.protocol === 'local') { openLocalTermConfig('edit', rowData.id) } else { openSshConfig('edit', rowData.id) } } : undefined} />
          <MenuItem icon={icons.copyPlus} label="批量编辑" disabled={isBlank || isFolder} onClick={!isBlank && !isFolder ? () => { ctx.close(); const ids = selectedRowIds.size > 0 ? [...selectedRowIds] : rowData ? [rowData.id] : []; if (ids.length > 0) openBatchEdit(ids) } : undefined} />
          <MenuItem icon={icons.fileX} label="删除" shortcut="Backspace" disabled={isBlank} onClick={rowData && !isBlank ? () => handleDelete(rowData.id, rowData.type === 'folder' ? 'folder' : 'asset') : undefined} />
          <MenuItem icon={icons.edit} label="重命名" shortcut="F2" disabled={isBlank} onClick={rowData && !isBlank ? () => handleRename(rowData.id, rowData.type === 'folder' ? 'folder' : 'asset', rowData.name) : undefined} />
          <MenuDivider />
          <MenuItem icon={icons.chevronDown} label="更多" hasSubmenu disabled={isBlank}>
            <MenuItem icon={icons.fileDown} label="通过文本批量导入SSH" onClick={() => { ctx.close(); const text = prompt('请输入 SSH 连接信息（每行一条，格式：user@host:port）'); if (!text) return; ;(async () => { let count = 0; for (const line of text.split('\n')) { const m = line.trim().match(/^(\S+)@(\S+?)(?::(\d+))?$/); if (m) { await api.createConnection({ name: `${m[1]}@${m[2]}`, host: m[2], port: m[3] ? parseInt(m[3]) : 22, username: m[1] }); count++ } } fetchAssets(); addToast('success', `成功导入 ${count} 条连接`) })() }} />
            <MenuItem icon={icons.key} label="上传 SSH公钥(ssh-copy-id)" disabled={isBlank || isFolder} onClick={rowData && !isBlank && !isFolder ? () => { ctx.close(); api.getSshKeys().then(keys => { if (keys.length === 0) { addToast('error', '请先在密钥库中添加密钥'); return } const names = keys.map((k, i) => `${i + 1}. ${k.name}`).join('\n'); const idx = prompt(`选择要上传的公钥：\n${names}\n\n请输入序号`, '1'); if (!idx) return; const key = keys[parseInt(idx) - 1]; if (!key) { addToast('error', '无效的序号'); return } api.uploadSshKey(rowData.id, key.id).then(r => addToast('success', r.message)).catch(e => addToast('error', (e as Error).message)) }) } : undefined} />
            <MenuItem icon={icons.activity} label="Ping" disabled={isBlank || isFolder} onClick={rowData && !isBlank && !isFolder ? () => { ctx.close(); api.pingConnections([rowData.id]).then(result => { const ms = result[rowData.id]; addToast('success', `${rowData.name}: ${ms !== null ? `${ms}ms` : '超时'}`) }).catch(() => addToast('error', 'Ping 失败')) } : undefined} />
            <MenuItem icon={icons.fileDown} label="导入" onClick={() => { ctx.close(); pickJsonFile().then(async (data) => { const conns = parseImportedConnections(data); let count = 0; for (const c of conns) { if (c.name && c.host) { await api.createConnection({ name: c.name, host: c.host, port: c.port, username: c.username ?? '', protocol: c.protocol, auth_method: c.auth_method, remark: c.remark, color_tag: c.color_tag, folder_id: c.folder_id }); count++ } } fetchAssets(); addToast('success', `成功导入 ${count} 条连接`) }).catch(() => {}) }} />
            <MenuItem icon={icons.fileUp} label="导出" onClick={() => { ctx.close(); if (selectedRowIds.size > 0) { const ids = [...selectedRowIds]; const connIds: string[] = []; for (const id of ids) { const r = tableData.find(row => row.id === id); if (!r) continue; if (r.type === 'asset') connIds.push(id); if (r.type === 'folder') tableData.filter(row => row.type === 'asset' && row.folderId === id).forEach(row => connIds.push(row.id)) } const unique = [...new Set(connIds)]; Promise.all(unique.map(id => api.getConnection(id))).then(conns => downloadJson({ connections: conns }, `vortix-export-${conns.length}.json`)) } else if (rowData) { api.getConnection(rowData.id).then(conn => downloadJson({ connections: [conn] }, `connection-${conn.name}.json`)) } else if (currentFolderId) { const folderConns = tableData.filter(r => r.type === 'asset' && r.folderId === currentFolderId); Promise.all(folderConns.map(r => api.getConnection(r.id))).then(conns => downloadJson({ connections: conns }, `vortix-folder-${conns.length}.json`)) } else { Promise.all([api.getFolders(), api.getConnections()]).then(([folders, connections]) => downloadJson({ folders, connections }, 'vortix-connections.json')) } }} />
          </MenuItem>
        </>
      )
    },
  })
}
