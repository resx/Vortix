/* ── SFTP 路径收藏 store ── */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BookmarkEntry } from '../types/sftp'

const nowLocalRfc3339 = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const offsetMinutes = -d.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  const oh = pad(Math.floor(abs / 60))
  const om = pad(abs % 60)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${oh}:${om}`
}

interface SftpBookmarkState {
  bookmarks: BookmarkEntry[]
  add: (path: string, label?: string) => void
  remove: (path: string) => void
  has: (path: string) => boolean
  toggle: (path: string) => void
}

export const useSftpBookmarkStore = create<SftpBookmarkState>()(
  persist(
    (set, get) => ({
      bookmarks: [],

      add: (path, label) => {
        if (get().bookmarks.some(b => b.path === path)) return
        const name = label || path.split('/').filter(Boolean).pop() || '/'
        set({
          bookmarks: [...get().bookmarks, {
            path,
            label: name,
            createdAt: nowLocalRfc3339(),
          }],
        })
      },

      remove: (path) => set({
        bookmarks: get().bookmarks.filter(b => b.path !== path),
      }),

      has: (path) => get().bookmarks.some(b => b.path === path),

      toggle: (path) => {
        if (get().has(path)) {
          get().remove(path)
        } else {
          get().add(path)
        }
      },
    }),
    { name: 'vortix-sftp-bookmarks' },
  ),
)
