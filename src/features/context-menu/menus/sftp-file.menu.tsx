/* ── SFTP 文件右键菜单（全局注册 - 保留原始版本） ── */

import { registerMenu } from '../../../registries/context-menu.registry'
import { MenuItem, MenuDivider } from '../components/MenuParts'
import { icons } from '../../../components/icons/AppIcon'
import type { SftpFileEntry } from '../../../types/sftp'

export interface SftpFileContextData {
  entry: SftpFileEntry
  onRefresh: () => void
  onDelete: (path: string, isDir: boolean) => void
  onRename: (entry: SftpFileEntry) => void
  onDownload: (entry: SftpFileEntry) => void
  onEdit: (entry: SftpFileEntry) => void
  onCopyPath: (path: string) => void
}

export function registerSftpFileMenu(): () => void {
  return registerMenu({
    types: ['sftp-file'],
    minWidth: 'min-w-[200px]',
    render: (ctx) => {
      const data = ctx.data as SftpFileContextData | null
      if (!data) return null
      const { entry, onRefresh, onDelete, onRename, onDownload, onEdit, onCopyPath } = data
      const isDir = entry.type === 'dir'

      return (
        <>
          {!isDir && (
            <MenuItem
              icon={icons.fileEdit}
              label="编辑"
              onClick={() => { ctx.close(); onEdit(entry) }}
            />
          )}
          <MenuItem
            icon={icons.download}
            label="下载"
            onClick={() => { ctx.close(); onDownload(entry) }}
          />
          <MenuDivider />
          <MenuItem
            icon={icons.pencil}
            label="重命名"
            onClick={() => { ctx.close(); onRename(entry) }}
          />
          <MenuItem
            icon={icons.copy}
            label="复制路径"
            onClick={() => { ctx.close(); onCopyPath(entry.path) }}
          />
          <MenuDivider />
          <MenuItem
            icon={icons.trash}
            label="删除"
            onClick={() => { ctx.close(); onDelete(entry.path, isDir) }}
          />
          <MenuDivider />
          <MenuItem
            icon={icons.refresh}
            label="刷新"
            onClick={() => { ctx.close(); onRefresh() }}
          />
        </>
      )
    },
  })
}
