import { registerMenu } from '../../../registries/context-menu.registry'
import { MenuItem, MenuDivider, ActionButton } from '../components/MenuParts'
import { useTabStore } from '../../../stores/useTabStore'
import { useWorkspaceStore, collectLeafIds } from '../../../stores/useWorkspaceStore'
import { useToastStore } from '../../../stores/useToastStore'
import { getSession } from '../../../stores/terminalSessionRegistry'
import { icons } from '../../../components/icons/AppIcon'
import type { TerminalContextData } from '../../../types'

/* ---- 模块级状态：记录中的面板 ---- */
const recordingPanes = new Map<string, number>()

/* ---- 注册终端右键菜单 ---- */
export function registerTerminalMenu(): () => void {
  return registerMenu({
    types: ['terminal'],
    minWidth: 'min-w-[260px]',
    render: (ctx) => {
      const data = ctx.data as TerminalContextData | null
      const noSelection = !data?.hasSelection
      const termTabId = data?.tabId
      const termPaneId = data?.paneId
      const hideContextMenu = ctx.close

      const { splitPane, closePane, workspaces } = useWorkspaceStore.getState()
      const ws = termTabId ? workspaces[termTabId] : null
      const paneCount = ws ? collectLeafIds(ws.rootNode).length : 1

      const { closeTab, duplicateTab, reconnectTab } = useTabStore.getState()
      const { addToast } = useToastStore.getState()

      const handleSplit = (dir: 'vertical' | 'horizontal') => {
        if (termTabId && termPaneId) {
          splitPane(termTabId, termPaneId, dir)
        }
        hideContextMenu()
      }

      const handleClosePane = () => {
        if (termTabId && termPaneId) {
          closePane(termTabId, termPaneId)
        }
        hideContextMenu()
      }

      const handleTermCopy = () => {
        hideContextMenu()
        if (!termPaneId) return
        const session = getSession(termPaneId)
        const sel = session?.term.getSelection()
        if (sel) navigator.clipboard.writeText(sel).catch(() => {})
      }

      const handleTermPaste = () => {
        hideContextMenu()
        if (!termPaneId) return
        navigator.clipboard.readText().then((text) => {
          const session = getSession(termPaneId)
          if (text && session?.ws?.readyState === WebSocket.OPEN) {
            session.ws.send(JSON.stringify({ type: 'input', data: text }))
          }
        }).catch(() => {})
      }

      const selectionText = termPaneId ? (getSession(termPaneId)?.term.getSelection() ?? '') : ''

      const handleSearch = (engine: 'google' | 'bing' | 'baidu') => {
        hideContextMenu()
        if (!selectionText) return
        const q = encodeURIComponent(selectionText)
        const urls = {
          google: `https://www.google.com/search?q=${q}`,
          bing: `https://www.bing.com/search?q=${q}`,
          baidu: `https://www.baidu.com/s?wd=${q}`,
        }
        window.open(urls[engine], '_blank')
      }

      return (
        <>
          <div className="flex items-center justify-between px-3 py-[4px] mb-1 border-b border-border/50">
            <span className="text-[11px] text-text-1 font-medium tracking-wide">操作</span>
            <div className="flex items-center bg-bg-base rounded border border-border p-[2px]">
              <ActionButton icon={icons.copy} tooltip="复制(Ctrl+Shift+C)" disabled={noSelection} onClick={!noSelection ? handleTermCopy : undefined} />
              <div className="w-px h-3 bg-border mx-[1px]" />
              <ActionButton icon={icons.clipboard} tooltip="粘贴(Ctrl+Shift+V)" disabled={false} onClick={handleTermPaste} />
            </div>
          </div>
          <MenuItem icon={icons.clipboardText} label="粘贴选中文本" disabled={noSelection} onClick={() => { hideContextMenu(); if (!termPaneId || !selectionText) return; const session = getSession(termPaneId); if (session?.ws?.readyState === WebSocket.OPEN) session.ws.send(JSON.stringify({ type: 'input', data: selectionText })) }} />
          <MenuItem icon={icons.search} label="搜索" hasSubmenu disabled={noSelection}>
            <div className="px-4 py-1 text-[11px] text-text-1 border-b border-border/50 mb-1">搜索引擎</div>
            <MenuItem icon={icons.search} label="Google" onClick={() => handleSearch('google')} />
            <MenuItem icon={icons.search} label="Bing" onClick={() => handleSearch('bing')} />
            <MenuItem icon={icons.search} label="百度" onClick={() => handleSearch('baidu')} />
          </MenuItem>
          <MenuItem icon={icons.appWindow} label="通过服务器代理 Chrome" />
          <MenuDivider />
          <MenuItem icon={icons.squareArrowOutUpRight} label="新终端窗口" shortcut="Ctrl+Shift+N" disabled={!termTabId} onClick={termTabId ? () => { hideContextMenu(); duplicateTab(termTabId) } : undefined} />
          <MenuItem icon={icons.refresh} label="重新连接" shortcut="Ctrl+Shift+R" disabled={!termTabId} onClick={termTabId ? () => { hideContextMenu(); reconnectTab(termTabId) } : undefined} />
          <MenuItem icon={icons.trash} label="清屏" shortcut="Ctrl+Shift+L" disabled={!termPaneId} onClick={termPaneId ? () => { hideContextMenu(); getSession(termPaneId)?.term.clear() } : undefined} />
          <MenuItem icon={icons.squareX} label="断开连接" shortcut="Ctrl+W" disabled={!termTabId} onClick={termTabId ? () => { hideContextMenu(); closeTab(termTabId) } : undefined} />
          <MenuItem icon={icons.fileEdit} label="唤起输入框输入" shortcut="Ctrl+I" disabled={!termPaneId} onClick={termPaneId ? () => { hideContextMenu(); const cmd = prompt('请输入命令'); if (!cmd) return; const session = getSession(termPaneId); if (session?.ws?.readyState === WebSocket.OPEN) session.ws.send(JSON.stringify({ type: 'input', data: cmd + '\n' })) } : undefined} />
          <MenuDivider />
          <MenuItem icon={icons.splitVertical} label="垂直分屏" shortcut="Ctrl+Shift+=" onClick={() => handleSplit('vertical')} />
          <MenuItem icon={icons.splitHorizontal} label="水平分屏" shortcut="Ctrl+Shift+-" onClick={() => handleSplit('horizontal')} />
          <MenuItem icon={icons.squareX} label="关闭面板" disabled={paneCount <= 1} onClick={handleClosePane} />
          <MenuDivider />
          <MenuItem icon={icons.chevronDown} label="更多" hasSubmenu>
            <div className="px-4 py-1 text-[11px] text-text-1 border-b border-border/50 mb-1">更多</div>
            <MenuItem icon={icons.clock} label={termPaneId && recordingPanes.has(termPaneId) ? "停止记录日志" : "开始记录日志"} onClick={() => { hideContextMenu(); if (!termPaneId) return; const session = getSession(termPaneId); if (!session?.term) return; if (recordingPanes.has(termPaneId)) { const startLine = recordingPanes.get(termPaneId)!; recordingPanes.delete(termPaneId); const buf = session.term.buffer.active; const lines: string[] = []; for (let i = startLine; i < buf.length; i++) { const line = buf.getLine(i); if (line) lines.push(line.translateToString(true)) } const blob = new Blob([lines.join('\n')], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `terminal-record-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`; a.click(); URL.revokeObjectURL(url); addToast('success', '日志已保存') } else { recordingPanes.set(termPaneId, session.term.buffer.active.baseY + session.term.buffer.active.cursorY); addToast('success', '开始记录日志') } }} />
            <MenuItem icon={icons.save} label="保存为日志" onClick={() => { hideContextMenu(); if (!termPaneId) return; const session = getSession(termPaneId); if (!session?.term) return; const buf = session.term.buffer.active; const lines: string[] = []; for (let i = 0; i < buf.length; i++) { const line = buf.getLine(i); if (line) lines.push(line.translateToString(true)) } const blob = new Blob([lines.join('\n')], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `terminal-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`; a.click(); URL.revokeObjectURL(url) }} />
            <MenuItem icon={icons.terminalSquare} label="批量执行命令" onClick={() => { hideContextMenu(); const cmd = prompt('请输入要在所有终端中执行的命令'); if (!cmd) return; const allTabs = useTabStore.getState().tabs; const wsStore = useWorkspaceStore.getState(); let count = 0; for (const t of allTabs) { if (t.type !== 'asset') continue; const pids = wsStore.getAllPaneIds(t.id); for (const pid of pids) { const s = getSession(pid); if (s?.ws?.readyState === WebSocket.OPEN) { s.ws.send(JSON.stringify({ type: 'input', data: cmd + '\n' })); count++ } } } addToast('success', `命令已发送到 ${count} 个终端`) }} />
            <MenuItem icon={icons.fileDown} label="SCP 下载" shortcut="Ctrl+Shift+D" />
            <MenuItem icon={icons.fileUp} label="SCP 上传" shortcut="Ctrl+Shift+U" />
          </MenuItem>
        </>
      )
    },
  })
}
