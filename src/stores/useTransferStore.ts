/* ── 全局传输队列状态 ── */

import { create } from 'zustand'
import type { TransferTask, TransferStatus } from '../types/sftp'

interface TransferState {
  tasks: TransferTask[]
  maxConcurrent: number

  // Actions
  enqueue: (task: Omit<TransferTask, 'status' | 'bytesTransferred' | 'speed'>) => void
  updateProgress: (id: string, bytesTransferred: number, speed: number) => void
  updateStatus: (id: string, status: TransferStatus, error?: string) => void
  pause: (id: string) => void
  resume: (id: string) => void
  cancel: (id: string) => void
  retry: (id: string) => void
  remove: (id: string) => void
  clearCompleted: () => void

  // Selectors
  getByStatus: (status: TransferStatus) => TransferTask[]
  getActive: () => TransferTask[]
  getQueued: () => TransferTask[]
  activeCount: () => number
}

export const useTransferStore = create<TransferState>((set, get) => ({
  tasks: [],
  maxConcurrent: 3,

  enqueue: (task) => {
    const newTask: TransferTask = {
      ...task,
      status: 'queued',
      bytesTransferred: 0,
      speed: 0,
      startedAt: Date.now(),
    }
    set(s => ({ tasks: [...s.tasks, newTask] }))
  },

  updateProgress: (id, bytesTransferred, speed) => {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === id ? { ...t, bytesTransferred, speed, status: 'active' as TransferStatus } : t
      ),
    }))
  },

  updateStatus: (id, status, error) => {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === id ? {
          ...t,
          status,
          error: error ?? t.error,
          completedAt: (status === 'completed' || status === 'failed' || status === 'cancelled') ? Date.now() : t.completedAt,
          speed: (status === 'completed' || status === 'failed' || status === 'cancelled') ? 0 : t.speed,
        } : t
      ),
    }))
  },

  pause: (id) => {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === id && t.status === 'active' ? { ...t, status: 'paused' as TransferStatus, speed: 0 } : t
      ),
    }))
  },

  resume: (id) => {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === id && t.status === 'paused' ? { ...t, status: 'queued' as TransferStatus } : t
      ),
    }))
  },

  cancel: (id) => {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === id && (t.status === 'active' || t.status === 'queued' || t.status === 'paused')
          ? { ...t, status: 'cancelled' as TransferStatus, speed: 0, completedAt: Date.now() }
          : t
      ),
    }))
  },

  retry: (id) => {
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === id && t.status === 'failed'
          ? { ...t, status: 'queued' as TransferStatus, bytesTransferred: 0, speed: 0, error: undefined, completedAt: undefined }
          : t
      ),
    }))
  },

  remove: (id) => {
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }))
  },

  clearCompleted: () => {
    set(s => ({ tasks: s.tasks.filter(t => t.status !== 'completed') }))
  },

  getByStatus: (status) => get().tasks.filter(t => t.status === status),
  getActive: () => get().tasks.filter(t => t.status === 'active'),
  getQueued: () => get().tasks.filter(t => t.status === 'queued'),
  activeCount: () => get().tasks.filter(t => t.status === 'active' || t.status === 'queued').length,
}))
