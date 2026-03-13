/* ── SFTP 工具栏 ── */

import { AppIcon, icons } from '../../icons/AppIcon'
import { useSftpStore } from '../../../stores/useSftpStore'

interface Props {
  onUpload: () => void
  onDownload: () => void
  onRefresh: () => void
  onMkdir: () => void
  onClose: () => void
}

export default function SftpToolbar({ onUpload, onDownload, onRefresh, onMkdir, onClose }: Props) {
  const connected = useSftpStore(s => s.connected)
  const showHidden = useSftpStore(s => s.showHidden)
  const setShowHidden = useSftpStore(s => s.setShowHidden)

  return (
    <div className="h-[38px] flex items-center justify-between px-3 border-b border-border shrink-0">
      <span className="text-[13px] font-bold text-text-1">SFTP</span>
      <div className="flex items-center gap-0.5">
        <button
          className="p-1 rounded-md text-text-2 hover:bg-bg-hover transition-colors disabled:opacity-30"
          disabled={!connected}
          onClick={onUpload}
          title="上传文件"
        >
          <AppIcon icon={icons.upload} size={14} />
        </button>
        <button
          className="p-1 rounded-md text-text-2 hover:bg-bg-hover transition-colors disabled:opacity-30"
          disabled={!connected}
          onClick={onDownload}
          title="下载选中"
        >
          <AppIcon icon={icons.download} size={14} />
        </button>
        <button
          className="p-1 rounded-md text-text-2 hover:bg-bg-hover transition-colors disabled:opacity-30"
          disabled={!connected}
          onClick={onMkdir}
          title="新建目录"
        >
          <AppIcon icon={icons.folderPlus} size={14} />
        </button>
        <button
          className="p-1 rounded-md text-text-2 hover:bg-bg-hover transition-colors disabled:opacity-30"
          disabled={!connected}
          onClick={onRefresh}
          title="刷新"
        >
          <AppIcon icon={icons.refresh} size={14} />
        </button>
        <button
          className={`p-1 rounded-md transition-colors ${showHidden ? 'text-primary bg-primary/10' : 'text-text-2 hover:bg-bg-hover'}`}
          onClick={() => setShowHidden(!showHidden)}
          title={showHidden ? '隐藏隐藏文件' : '显示隐藏文件'}
        >
          <AppIcon icon={showHidden ? icons.eye : icons.eyeOff} size={14} />
        </button>
        <button
          className="p-1 rounded-md text-text-2 hover:bg-bg-hover transition-colors"
          onClick={onClose}
          title="关闭"
        >
          <AppIcon icon={icons.close} size={14} />
        </button>
      </div>
    </div>
  )
}
