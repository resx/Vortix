import { useAppStore } from '../../stores/useAppStore'

export default function DirModal() {
  const showDirModal = useAppStore((s) => s.showDirModal)
  const dirName = useAppStore((s) => s.dirName)
  const setDirName = useAppStore((s) => s.setDirName)
  const setShowDirModal = useAppStore((s) => s.setShowDirModal)

  if (!showDirModal) return null

  return (
    <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-[999] flex items-center justify-center">
      <div className="bg-white/80 backdrop-blur-xl w-[320px] rounded-xl shadow-xl overflow-hidden flex flex-col border border-white/60">
        <div className="p-4 pt-5 pb-6">
          <div className="text-[14px] text-[#1F2329] font-medium mb-4">请输入目录名称</div>
          <input
            type="text"
            className="w-full h-[36px] border border-[#4080FF] rounded-lg px-3 text-[13px] text-[#1F2329] focus:outline-none focus:ring-2 focus:ring-[#4080FF]/20"
            value={dirName}
            onChange={(e) => setDirName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-3 px-5 pb-4 pt-2 bg-[#F7F8FA] border-t border-[#E5E6EB]">
          <button
            className="px-4 py-1.5 text-[13px] text-[#4E5969] hover:text-[#1F2329] rounded-lg hover:bg-[#E5E6EB]/50 transition-colors"
            onClick={() => setShowDirModal(false)}
          >
            取消
          </button>
          <button
            className="px-4 py-1.5 text-[13px] text-white bg-[#4080FF] rounded-lg hover:bg-[#3070EE] transition-colors"
            onClick={() => setShowDirModal(false)}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
