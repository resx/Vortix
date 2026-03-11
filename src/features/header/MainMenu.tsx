/* ── 主菜单 ── */

import { AppIcon, icons } from '../../components/icons/AppIcon'
import { ProtocolIcon } from '../../components/icons/ProtocolIcons'
import { useAssetStore } from '../../stores/useAssetStore'
import { useTabStore } from '../../stores/useTabStore'
import { useUIStore } from '../../stores/useUIStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useT, useLocale } from '../../i18n'
import { openNewWindow, cloneCurrentWindow, closeWindow } from '../../lib/window'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '../../components/ui/dropdown-menu'

export default function MainMenu() {
  const menuVariant = useUIStore((s) => s.menuVariant)
  const toggleSettings = useUIStore((s) => s.toggleSettings)
  const toggleQuickSearch = useUIStore((s) => s.toggleQuickSearch)
  const toggleUpdateDialog = useUIStore((s) => s.toggleUpdateDialog)
  const toggleClearDataDialog = useUIStore((s) => s.toggleClearDataDialog)
  const recentConnections = useAssetStore((s) => s.recentConnections)
  const fetchRecentConnections = useAssetStore((s) => s.fetchRecentConnections)
  const tableData = useAssetStore((s) => s.tableData)
  const openAssetTab = useTabStore((s) => s.openAssetTab)
  const serializeTabState = useTabStore((s) => s.serializeTabState)
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const t = useT()
  const locale = useLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="hover:text-text-1 transition-colors">
          <AppIcon icon={icons.moreVertical} size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent variant={menuVariant} align="end" sideOffset={12}>
        {/* 新窗口子菜单 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <AppIcon icon={icons.externalLink} size={14} className="text-text-2" />
            {t('menu.newWindow')}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent sideOffset={4} side="left">
              <DropdownMenuItem onSelect={() => openNewWindow()}>
                <div className="flex items-center gap-2.5">
                  <AppIcon icon={icons.externalLink} size={14} className="text-text-2" />
                  {t('menu.newWindow')}
                </div>
                <DropdownMenuShortcut>Ctrl+Shift+H</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => cloneCurrentWindow(serializeTabState())}>
                <div className="flex items-center gap-2.5">
                  <AppIcon icon={icons.copy} size={14} className="text-text-2" />
                  {t('menu.cloneWindow')}
                </div>
                <DropdownMenuShortcut>Ctrl+Shift+N</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* 最近项目 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger onPointerEnter={() => fetchRecentConnections()}>
            <AppIcon icon={icons.history} size={14} className="text-text-2" />
            {t('menu.recentProjects')}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent sideOffset={4} side="left">
              {recentConnections.length === 0 ? (
                <DropdownMenuItem disabled>
                  <span className="text-text-3">{t('menu.recentProjects.empty')}</span>
                </DropdownMenuItem>
              ) : (
                recentConnections.map((rc) => (
                  <DropdownMenuItem
                    key={rc.id}
                    onSelect={() => {
                      const row = tableData.find(r => r.type === 'asset' && r.id === rc.id)
                      if (row) openAssetTab(row)
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <ProtocolIcon protocol={rc.protocol} size={14} className="!text-text-2" />
                      <div className="flex flex-col">
                        <span>{rc.name}</span>
                        <span className="text-[11px] text-text-3">{rc.host}</span>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* 语言 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <AppIcon icon={icons.languages} size={14} className="text-text-2" />
            {t('menu.language')}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent sideOffset={4} side="left">
              <DropdownMenuItem
                className={locale === 'zh-CN' ? 'bg-primary-bg text-primary' : ''}
                onSelect={() => updateSetting('language', 'zh-CN')}
              >
                中文{locale === 'zh-CN' ? ' ✓' : ''}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={locale === 'en' ? 'bg-primary-bg text-primary' : ''}
                onSelect={() => updateSetting('language', 'en')}
              >
                English{locale === 'en' ? ' ✓' : ''}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* 帮助 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <AppIcon icon={icons.help} size={14} className="text-text-2" />
            {t('menu.help')}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent sideOffset={4} side="left">
              <DropdownMenuItem onSelect={() => window.open('https://github.com/resx/Vortix/issues/new?template=bug_report.md&labels=bug', '_blank')}>
                <div className="flex items-center gap-2.5">
                  <AppIcon icon={icons.alertCircle} size={14} className="text-text-2" />
                  {t('menu.help.submitIssue')}
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.open('https://github.com/resx/Vortix/discussions', '_blank')}>
                <div className="flex items-center gap-2.5">
                  <AppIcon icon={icons.messageCircle} size={14} className="text-text-2" />
                  {t('menu.help.faq')}
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.open('https://github.com/resx/Vortix/releases', '_blank')}>
                <div className="flex items-center gap-2.5">
                  <AppIcon icon={icons.scrollText} size={14} className="text-text-2" />
                  {t('menu.help.changelog')}
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleUpdateDialog()}>
                <div className="flex items-center gap-2.5">
                  <AppIcon icon={icons.rotateCw} size={14} className="text-text-2" />
                  {t('menu.help.checkUpdate')}
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleClearDataDialog()}>
                <div className="flex items-center gap-2.5">
                  <AppIcon icon={icons.trash} size={14} className="text-text-2" />
                  {t('menu.help.clearData')}
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => window.open('https://github.com/resx/Vortix', '_blank')}>
                <div className="flex items-center gap-2.5">
                  <AppIcon icon={icons.info} size={14} className="text-text-2" />
                  {t('menu.help.about')}
                </div>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => {
          const uiStore = useUIStore.getState()
          uiStore.setSettingsInitialNav('sync')
          if (!uiStore.settingsOpen) uiStore.toggleSettings()
        }}>
          <div className="flex items-center gap-2.5">
            <AppIcon icon={icons.cloudCog} size={14} className="text-text-2" />
            数据同步
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleSettings}>
          <div className="flex items-center gap-2.5">
            <AppIcon icon={icons.settings} size={14} className="text-text-2" />
            {t('menu.settings')}
          </div>
          <DropdownMenuShortcut>Ctrl+,</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toggleQuickSearch()}>
          <div className="flex items-center gap-2.5">
            <AppIcon icon={icons.search} size={14} className="text-text-2" />
            {t('menu.quickSearch')}
          </div>
          <DropdownMenuShortcut>Ctrl+Shift+F</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => {
          const { tabs } = useTabStore.getState()
          const hasConnected = tabs.some(t => t.status === 'connected')
          hasConnected ? useUIStore.getState().toggleReloadDialog() : location.reload()
        }}>
          <div className="flex items-center gap-2.5">
            <AppIcon icon={icons.rotateCw} size={14} className="text-text-2" />
            {t('menu.reload')}
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => closeWindow()}>
          <div className="flex items-center gap-2.5">
            <AppIcon icon={icons.logOut} size={14} className="text-text-2" />
            {t('menu.exit')}
          </div>
          <DropdownMenuShortcut>Alt+F4</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
