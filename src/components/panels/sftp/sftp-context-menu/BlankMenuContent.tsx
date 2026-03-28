import { icons } from '../../../icons/AppIcon'
import type { SftpActions } from './types'
import { Divider, Item } from './primitives'

interface BlankMenuContentProps {
  hasClipboard: boolean
  actions: SftpActions
  onClose: () => void
  onRefresh?: () => void
}

export function BlankMenuContent({ hasClipboard, actions, onClose, onRefresh }: BlankMenuContentProps) {
  const close = onClose

  return (
    <>
      <Item
        icon={icons.clipboardPaste}
        label="粘贴"
        disabled={!hasClipboard}
        onClick={() => { close(); actions.handlePaste() }}
      />
      <Item icon={icons.refresh} label="刷新" onClick={() => { close(); onRefresh?.() }} />

      <Divider />

      <Item icon={icons.pin} label="收藏当前路径" onClick={() => { close(); actions.handleBookmark() }} />

      <Divider />

      <Item icon={icons.upload} label="上传文件" onClick={() => { close(); actions.handleUpload() }} />
      <Item icon={icons.folderOpen} label="上传文件夹" onClick={() => { close(); actions.handleUploadFolder() }} />

      <Divider />

      <Item icon={icons.folderPlus} label="新建目录" onClick={() => { close(); actions.handleMkdir() }} />
      <Item icon={icons.filePlus} label="新建文件" onClick={() => { close(); actions.handleNewFile() }} />
    </>
  )
}
