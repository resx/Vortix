import { AppIcon, icons } from '../../icons/AppIcon'
import { ProtocolIcon, DB_LABEL_PROTOCOL } from '../../icons/ProtocolIcons'
import { useUIStore } from '../../../stores/useUIStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'

export function NewAssetDropdown() {
  const openSshConfig = useUIStore((s) => s.openSshConfig)
  const openLocalTermConfig = useUIStore((s) => s.openLocalTermConfig)
  const setShowDirModal = useUIStore((s) => s.setShowDirModal)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-[5px] rounded-md flex items-center justify-center transition-colors text-text-1 hover:bg-bg-hover">
          <AppIcon icon={icons.link} size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={6}>
        <DropdownMenuItem onSelect={() => setShowDirModal(true)}>
          <div className="flex items-center gap-2.5">
            <AppIcon icon={icons.folderPlus} size={14} className="text-text-2" />
            <span>目录</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openLocalTermConfig('create')}>
          <div className="flex items-center gap-2.5">
            <AppIcon icon={icons.localTerminal} size={14} className="text-text-2" />
            <span>本地终端</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <div className="flex items-center gap-2.5">
            <AppIcon icon={icons.container} size={14} className="text-text-2" />
            <span>Docker</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <AppIcon icon={icons.screenShare} size={14} className="text-text-2" />
            <span>远程连接</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={6}>
            <DropdownMenuItem onSelect={() => openSshConfig('create')}>
              <div className="flex items-center gap-2.5">
                <AppIcon icon={icons.terminal} size={14} className="text-text-2" />
                <span>SSH</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem><div className="flex items-center gap-2.5"><AppIcon icon={icons.network} size={14} className="text-text-2" /><span>SSH隧道</span></div></DropdownMenuItem>
            <DropdownMenuItem><div className="flex items-center gap-2.5"><AppIcon icon={icons.screenShare} size={14} className="text-text-2" /><span>RDP</span></div></DropdownMenuItem>
            <DropdownMenuItem><div className="flex items-center gap-2.5"><AppIcon icon={icons.monitor} size={14} className="text-text-2" /><span>Telnet</span></div></DropdownMenuItem>
            <DropdownMenuItem><div className="flex items-center gap-2.5"><AppIcon icon={icons.usb} size={14} className="text-text-2" /><span>串口</span></div></DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <AppIcon icon={icons.database} size={14} className="text-text-2" />
            <span>数据库</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={6}>
            {['Redis', 'MySQL', 'MariaDB', 'PostgreSQL', 'SqlServer', 'ClickHouse', 'SQLite', 'Oracle', '达梦'].map((db) => (
              <DropdownMenuItem key={db}>
                <div className="flex items-center gap-2.5">
                  <ProtocolIcon protocol={DB_LABEL_PROTOCOL[db]} variant="menu" size={14} mono className="text-text-1" />
                  <span>{db}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
