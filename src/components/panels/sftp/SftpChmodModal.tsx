/* ── SFTP 权限编辑弹窗 ── */

import { useState, useEffect, useCallback } from 'react'
import IslandModal from '../../ui/island-modal'

interface Props {
  isOpen: boolean
  filePath: string
  currentMode: string
  isDir: boolean
  onApply: (mode: string, recursive: boolean) => void
  onClose: () => void
}

const LABELS = ['所有者', '用户组', '其他'] as const
const PERMS = ['读取', '写入', '执行'] as const
const BITS = [
  [0o400, 0o200, 0o100],
  [0o040, 0o020, 0o010],
  [0o004, 0o002, 0o001],
]

function parseOctal(mode: string): number {
  const n = parseInt(mode, 8)
  return isNaN(n) ? 0o644 : n & 0o777
}

function toOctalStr(mode: number): string {
  return (mode & 0o777).toString(8).padStart(3, '0')
}

export default function SftpChmodModal({ isOpen, filePath, currentMode, isDir, onApply, onClose }: Props) {
  const [mode, setMode] = useState(0o644)
  const [recursive, setRecursive] = useState(false)
  const [octalInput, setOctalInput] = useState('644')

  useEffect(() => {
    if (isOpen) {
      const parsed = parseOctal(currentMode || (isDir ? '755' : '644'))
      setMode(parsed)
      setOctalInput(toOctalStr(parsed))
      setRecursive(false)
    }
  }, [isOpen, currentMode, isDir])

  const toggleBit = useCallback((row: number, col: number) => {
    setMode(prev => {
      const next = prev ^ BITS[row][col]
      setOctalInput(toOctalStr(next))
      return next
    })
  }, [])

  const handleOctalChange = useCallback((val: string) => {
    setOctalInput(val)
    if (/^[0-7]{3}$/.test(val)) {
      setMode(parseInt(val, 8))
    }
  }, [])
  const handleApply = useCallback(() => {
    onApply(toOctalStr(mode), recursive)
    onClose()
  }, [mode, recursive, onApply, onClose])

  const fileName = filePath.split('/').pop() || filePath

  const footer = (
    <>
      <div />
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1.5 text-[12px] text-text-2 hover:bg-bg-hover rounded-lg transition-colors"
          onClick={onClose}
        >
          取消
        </button>
        <button
          className="px-3 py-1.5 text-[12px] text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
          onClick={handleApply}
        >
          应用
        </button>
      </div>
    </>
  )

  return (
    <IslandModal
      title="修改权限"
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-sm"
      footer={footer}
    >
      <div className="space-y-4">
        {/* 文件名 */}
        <div className="text-[12px] text-text-2 truncate" title={filePath}>
          {fileName}
        </div>

        {/* 3×3 权限矩阵 */}
        <div className="space-y-1">
          {/* 表头 */}
          <div className="grid grid-cols-4 gap-2 text-[11px] text-text-3 font-medium">
            <div />
            {PERMS.map(p => <div key={p} className="text-center">{p}</div>)}
          </div>
          {/* 行 */}
          {LABELS.map((label, row) => (
            <div key={label} className="grid grid-cols-4 gap-2 items-center">
              <span className="text-[12px] text-text-1">{label}</span>
              {[0, 1, 2].map(col => (
                <label key={col} className="flex justify-center">
                  <input
                    type="checkbox"
                    className="accent-primary w-3.5 h-3.5 cursor-pointer"
                    checked={(mode & BITS[row][col]) !== 0}
                    onChange={() => toggleBit(row, col)}
                  />
                </label>
              ))}
            </div>
          ))}
        </div>

        {/* 八进制输入 */}
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-text-2">八进制</span>
          <input
            className="w-[80px] h-[28px] px-2 text-[13px] font-mono text-center bg-bg-subtle border border-border rounded-md text-text-1 outline-none focus:border-primary/50"
            value={octalInput}
            onChange={e => handleOctalChange(e.target.value)}
            maxLength={3}
            placeholder="644"
          />
          <span className="text-[11px] text-text-3 font-mono">
            {toOctalStr(mode)}
          </span>
        </div>

        {/* 递归选项（仅目录） */}
        {isDir && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-primary w-3.5 h-3.5"
              checked={recursive}
              onChange={e => setRecursive(e.target.checked)}
            />
            <span className="text-[12px] text-text-1">递归应用到子目录</span>
          </label>
        )}
      </div>
    </IslandModal>
  )
}
