import { useState } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { useAssetStore } from '../../stores/useAssetStore'
import { useUIStore } from '../../stores/useUIStore'

export default function DirModal() {
  const showDirModal = useUIStore((s) => s.showDirModal)
  const dirName = useUIStore((s) => s.dirName)
  const setDirName = useUIStore((s) => s.setDirName)
  const setShowDirModal = useUIStore((s) => s.setShowDirModal)
  const createFolderAction = useAssetStore((s) => s.createFolderAction)
  const [saving, setSaving] = useState(false)

  if (!showDirModal) return null

  const handleConfirm = async () => {
    const name = dirName.trim()
    if (!name || saving) return
    setSaving(true)
    try {
      await createFolderAction(name)
      setShowDirModal(false)
    } catch {
      // 静默处理，后续可加 toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[999] flex items-center justify-center">
      <div className="bg-bg-base rounded-xl shadow-2xl border border-border/60 w-[360px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* 外层头部 */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0">
          <h3 className="text-[14px] font-bold text-text-1 tracking-wide">新建目录</h3>
          <button
            onClick={() => setShowDirModal(false)}
            className="p-1.5 hover:bg-bg-hover rounded-md text-text-3 transition-colors"
          >
            <AppIcon icon={icons.close} size={16} />
          </button>
        </div>

        {/* 白色岛屿区 */}
        <div className="mx-4 bg-bg-card rounded-xl border border-border/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4">
            <input
              type="text"
              className="w-full bg-bg-base border border-transparent rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder-text-3 text-text-1"
              placeholder="请输入目录名称"
              value={dirName}
              onChange={(e) => setDirName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
              autoFocus
            />
          </div>
        </div>

        {/* 外层底部按钮 */}
        <div className="px-5 py-3.5 flex justify-end gap-3 shrink-0">
          <button
            className="text-xs text-orange-500 hover:text-orange-600 transition-colors"
            onClick={() => setShowDirModal(false)}
          >
            取消
          </button>
          <button
            className={`text-xs font-medium transition-colors ${!dirName.trim() || saving ? 'text-text-disabled cursor-not-allowed' : 'text-primary hover:opacity-80'}`}
            onClick={handleConfirm}
            disabled={!dirName.trim() || saving}
          >
            {saving ? '创建中...' : '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}
