import { icons } from '../../../icons/AppIcon'
import type { SftpFileEntry } from '../../../../types/sftp'
import type { SftpActions } from './types'
import { Divider, Item, SubMenu } from './primitives'

interface EntryMenuContentProps {
  entry: SftpFileEntry
  selectedEntries: SftpFileEntry[]
  selectedFiles: SftpFileEntry[]
  selectedCount: number
  hasSelection: boolean
  hasClipboard: boolean
  actions: SftpActions
  onClose: () => void
  onRefresh?: () => void
  onOpenChmod?: (path: string, permissions: string, isDir: boolean) => void
}

export function EntryMenuContent({
  entry,
  selectedEntries,
  selectedFiles,
  selectedCount,
  hasSelection,
  hasClipboard,
  actions,
  onClose,
  onRefresh,
  onOpenChmod,
}: EntryMenuContentProps) {
  const isDir = entry.type === 'dir'
  const isFile = entry.type === 'file'
  const multipleSelected = selectedCount > 1
  const close = onClose

  return (
    <>
      <div className="flex items-center justify-between px-3 py-[4px] mb-1 border-b border-border/50">
        <span className="text-[11px] text-text-1 font-medium tracking-wide">
          {multipleSelected ? `已选择 ${selectedCount} 项` : '操作'}
        </span>
      </div>

      {!multipleSelected && isFile && (
        <Item icon={icons.externalLink} label="本地打开" onClick={() => { close(); actions.handleLocalOpen(entry) }} />
      )}
      {!multipleSelected && isFile && (
        <Item icon={icons.fileEdit} label="在线编辑" onClick={() => { close(); actions.handleEdit(entry) }} />
      )}
      {!multipleSelected && isDir && (
        <Item icon={icons.folderOpen} label="打开目录" onClick={() => { close(); actions.handleNavigate(entry.path) }} />
      )}

      <Divider />

      <Item
        icon={icons.copy}
        label={multipleSelected ? '复制选中项' : '复制'}
        disabled={!hasSelection}
        onClick={() => { close(); actions.handleCopy() }}
      />
      <Item
        icon={icons.scissors}
        label={multipleSelected ? '剪切选中项' : '剪切'}
        disabled={!hasSelection}
        onClick={() => { close(); actions.handleCut() }}
      />
      <Item
        icon={icons.clipboardPaste}
        label="粘贴"
        disabled={!hasClipboard}
        onClick={() => { close(); actions.handlePaste() }}
      />

      <Divider />

      <Item icon={icons.refresh} label="刷新" onClick={() => { close(); onRefresh?.() }} />
      <Item icon={icons.pin} label="收藏当前路径" onClick={() => { close(); actions.handleBookmark() }} />

      <Divider />

      {!multipleSelected && isFile && (
        <Item icon={icons.download} label="下载至" onClick={() => { close(); actions.handleDownloadTo(entry) }} />
      )}
      <Item
        icon={icons.download}
        label={multipleSelected ? '批量下载' : '下载'}
        disabled={selectedFiles.length === 0}
        onClick={() => { close(); actions.handleDownload() }}
      />
      <Item icon={icons.upload} label="上传文件" onClick={() => { close(); actions.handleUpload() }} />
      <Item icon={icons.folderOpen} label="上传文件夹" onClick={() => { close(); actions.handleUploadFolder() }} />
      <Item
        icon={icons.arrowUpRight}
        label={multipleSelected ? '批量传输到对侧' : '传输到对侧'}
        disabled={!hasSelection}
        onClick={() => { close(); actions.handleTransferToPeer() }}
      />

      <SubMenu icon={icons.arrowUpRight} label="SCP 传输">
        <Item icon={icons.download} label="SCP 下载" onClick={() => { close(); actions.handleScpDownload() }} />
        <Item icon={icons.upload} label="SCP 上传" onClick={() => { close(); actions.handleScpUpload() }} />
      </SubMenu>

      <Divider />

      <Item
        icon={icons.folderArchive}
        label={multipleSelected ? '批量压缩' : '压缩'}
        disabled={!hasSelection}
        onClick={() => { close(); actions.handleCompress() }}
      />
      {!multipleSelected && isFile && (
        <Item icon={icons.fileDown} label="解压缩" onClick={() => { close(); actions.handleDecompress(entry) }} />
      )}

      <Divider />

      {!multipleSelected && (
        <Item icon={icons.pencil} label="重命名" onClick={() => { close(); actions.handleRename(entry) }} />
      )}
      {!multipleSelected ? (
        <Item icon={icons.trash} label="删除" onClick={() => { close(); actions.handleDelete(entry.path, isDir) }} />
      ) : (
        <Item
          icon={icons.trash}
          label="批量删除"
          onClick={() => {
            close()
            actions.handleDeleteSelected()
          }}
        />
      )}

      <Divider />

      <SubMenu icon={icons.moreVertical} label="更多">
        {!multipleSelected && (
          <Item icon={icons.copy} label="复制路径" onClick={() => { close(); actions.handleCopyPath(entry.path) }} />
        )}
        {multipleSelected && (
          <Item icon={icons.copy} label="复制选中项路径" onClick={() => { close(); actions.handleCopyPath(selectedEntries.map((item) => item.path).join('\n')) }} />
        )}
        <Divider />
        <Item icon={icons.folderPlus} label="新建目录" onClick={() => { close(); actions.handleMkdir() }} />
        <Item icon={icons.filePlus} label="新建文件" onClick={() => { close(); actions.handleNewFile() }} />
        <Divider />
        {!multipleSelected && (
          <Item icon={icons.key} label="修改权限" onClick={() => {
            close()
            onOpenChmod?.(entry.path, entry.permissions || '', isDir ?? false)
          }} />
        )}
      </SubMenu>
    </>
  )
}
