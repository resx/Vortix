import { registerMenu } from '../../../registries/context-menu.registry'
import { MenuItem, MenuDivider } from '../components/MenuParts'
import { icons } from '../../../components/icons/AppIcon'
import { useTabStore } from '../../../stores/useTabStore'
import { useUIStore } from '../../../stores/useUIStore'
import type { TabContextData } from '../../../types'

export function registerTabMenu(): () => void {
  return registerMenu({
    types: ['tab-context'],
    minWidth: 'min-w-[260px]',
    render(ctx) {
      const data = ctx.data as TabContextData | null
      const tabId = data?.tabId ?? ''
      const { tabs, closeTab, closeOtherTabs, closeAllTabs, closeLeftTabs, closeRightTabs, renameTab, duplicateTab, reconnectTab } = useTabStore.getState()
      const { openSshConfig } = useUIStore.getState()

      const tab = tabs.find(t => t.id === tabId)
      const assetTabs = tabs.filter(t => t.type === 'asset')
      const tabIdx = assetTabs.findIndex(t => t.id === tabId)
      const hasLeft = tabIdx > 0
      const hasRight = tabIdx >= 0 && tabIdx < assetTabs.length - 1
      const hasOthers = assetTabs.length > 1
      const assetRow = tab?.assetRow
      const connectionId = tab?.connectionId

      const handleRenameTab = () => {
        ctx.close()
        if (!tab) return
        const newName = prompt('请输入新的标签名称', tab.label)
        if (newName && newName !== tab.label) renameTab(tabId, newName)
      }

      return (
        <>
          <div className="px-4 py-1 text-[11px] text-text-1 font-medium">标签页</div>
          <MenuItem icon={icons.close} label="关闭" shortcut="Ctrl+W" onClick={() => { ctx.close(); closeTab(tabId) }} />
          <MenuItem icon={icons.copy} label="复制名称" onClick={() => { ctx.close(); if (tab) navigator.clipboard.writeText(tab.label) }} />
          <MenuItem icon={icons.copy} label="复制 Host" disabled={!assetRow?.host || assetRow.host === '-'} onClick={assetRow?.host && assetRow.host !== '-' ? () => { ctx.close(); navigator.clipboard.writeText(assetRow.host) } : undefined} />
          <MenuItem icon={icons.edit} label="编辑连接" disabled={!connectionId} onClick={connectionId ? () => { ctx.close(); openSshConfig('edit', connectionId) } : undefined} />
          <MenuItem icon={icons.refresh} label="重新连接" onClick={() => { ctx.close(); reconnectTab(tabId) }} />
          <MenuDivider />
          <MenuItem icon={icons.squareX} label="关闭其他" shortcut="Alt+O" disabled={!hasOthers} onClick={hasOthers ? () => { ctx.close(); closeOtherTabs(tabId) } : undefined} />
          <MenuItem icon={icons.squareX} label="关闭所有" shortcut="Alt+C" onClick={() => { ctx.close(); closeAllTabs() }} />
          <MenuItem icon={icons.squareX} label="关闭左边" shortcut="Alt+L" disabled={!hasLeft} onClick={hasLeft ? () => { ctx.close(); closeLeftTabs(tabId) } : undefined} />
          <MenuItem icon={icons.squareX} label="关闭右边" shortcut="Alt+R" disabled={!hasRight} onClick={hasRight ? () => { ctx.close(); closeRightTabs(tabId) } : undefined} />
          <MenuDivider />
          <MenuItem icon={icons.edit} label="重命名" onClick={handleRenameTab} />
          <MenuItem icon={icons.externalLink} label="新窗口打开" disabled={!assetRow} />
          <MenuItem icon={icons.filePlus} label="新标签页打开" disabled={!connectionId} onClick={connectionId ? () => { ctx.close(); duplicateTab(tabId) } : undefined} />
        </>
      )
    },
  })
}
