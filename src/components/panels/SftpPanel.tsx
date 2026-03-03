import { FolderOpen, File, Upload, Download, RefreshCw, X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { motion } from 'framer-motion'

const mockFiles = [
  { name: '..', type: 'dir' as const },
  { name: '.ssh', type: 'dir' as const },
  { name: 'documents', type: 'dir' as const },
  { name: 'projects', type: 'dir' as const },
  { name: '.bashrc', type: 'file' as const, size: '3.2 KB' },
  { name: '.profile', type: 'file' as const, size: '0.8 KB' },
  { name: 'deploy.sh', type: 'file' as const, size: '1.5 KB' },
]

export default function SftpPanel() {
  const toggleSftp = useAppStore((s) => s.toggleSftp)

  return (
    <motion.div
      id="sftp-panel"
      className="shrink-0 border-l border-[#E5E6EB] flex flex-col bg-white overflow-hidden"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 280, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {/* 头部 */}
      <div className="h-[38px] flex items-center justify-between px-3 border-b border-[#E5E6EB] shrink-0">
        <span className="text-[13px] font-bold text-[#1F2329]">SFTP</span>
        <div className="flex items-center gap-1">
          <button className="p-1 rounded-md text-[#4E5969] hover:bg-[#F2F3F5] transition-colors">
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 rounded-md text-[#4E5969] hover:bg-[#F2F3F5] transition-colors">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 rounded-md text-[#4E5969] hover:bg-[#F2F3F5] transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 rounded-md text-[#4E5969] hover:bg-[#F2F3F5] transition-colors" onClick={toggleSftp}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 路径栏 */}
      <div className="h-[32px] flex items-center px-3 border-b border-[#E5E6EB] bg-[#F7F8FA] shrink-0">
        <span className="text-[11px] text-[#86909C] font-mono truncate">/home/root</span>
      </div>

      {/* 文件列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {mockFiles.map((f) => (
          <div
            key={f.name}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#F2F3F5] cursor-pointer text-[12px]"
          >
            {f.type === 'dir' ? (
              <FolderOpen className="w-3.5 h-3.5 text-[#FADC19] shrink-0" />
            ) : (
              <File className="w-3.5 h-3.5 text-[#86909C] shrink-0" />
            )}
            <span className="flex-1 truncate text-[#1F2329]">{f.name}</span>
            {f.type === 'file' && (
              <span className="text-[10px] text-[#86909C] shrink-0">{f.size}</span>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}
