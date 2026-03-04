import { useAppStore } from '../../stores/useAppStore'

export default function DirModal() {
  const showDirModal = useAppStore((s) => s.showDirModal)
  const dirName = useAppStore((s) => s.dirName)
  const setDirName = useAppStore((s) => s.setDirName)
  const setShowDirModal = useAppStore((s) => s.setShowDirModal)

  if (!showDirModal) return null

  return (
    <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-[999] flex items-center justify-center">
      <div className="bg-bg-card/80 backdrop-blur-xl w-[320px] rounded-xl shadow-xl overflow-hidden flex flex-col border border-bg-card/60">
        <div className="p-4 pt-5 pb-6">
          <div className="text-[14px] text-text-1 font-medium mb-4">请输入目录名称</div>
          <input
            type="text"
            className="w-full h-[36px] border border-primary rounded-lg px-3 text-[13px] text-text-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={dirName}
            onChange={(e) => setDirName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3 px-5 pb-4 pt-2 bg-bg-subtle border-t border-border">
          <button
            className="px-4 py-1.5 text-[13px] text-text-2 hover:text-text-1 rounded-lg hover:bg-border/50 transition-colors"
            onClick={() => setShowDirModal(false)}
          >
            取消
          </button>
          <button
            className="px-4 py-1.5 text-[13px] text-white bg-primary rounded-lg hover:opacity-90 transition-colors"
            onClick={() => setShowDirModal(false)}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
