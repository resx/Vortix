/* ── SFTP 剪贴板状态 ── */

import { create } from 'zustand'
import type { SftpFileEntry, ClipboardAction } from '../types/sftp'

interface SftpClipboardItem {
  entry: SftpFileEntry
  action: ClipboardAction
  /** 来源目录路径 */
  sourcePath: string
}

interface SftpClipboardState {
  items: SftpClipboardItem[]
  action: ClipboardAction | null

  /** 复制选中文件到剪贴板 */
  copy: (entries: SftpFileEntry[], sourcePath: string) => void
  /** 剪切选中文件到剪贴板 */
  cut: (entries: SftpFileEntry[], sourcePath: string) => void
  /** 清空剪贴板 */
  clear: () => void
  /** 是否有内容 */
  hasItems: () => boolean
}

export const useSftpClipboardStore = create<SftpClipboardState>((set, get) => ({
  items: [],
  action: null,

  copy: (entries, sourcePath) => set({
    items: entries.map(entry => ({ entry, action: 'copy' as const, sourcePath })),
    action: 'copy',
  }),

  cut: (entries, sourcePath) => set({
    items: entries.map(entry => ({ entry, action: 'cut' as const, sourcePath })),
    action: 'cut',
  }),

  clear: () => set({ items: [], action: null }),

  hasItems: () => get().items.length > 0,
}))
