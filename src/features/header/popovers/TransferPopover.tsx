/* ── 文件传输弹出层 ── */

import { useEffect, useMemo, useState } from 'react'
import { AppIcon, icons } from '../../../components/icons/AppIcon'
import { useTransferStore } from '../../../stores/useTransferStore'
import { useSftpStore } from '../../../stores/useSftpStore'
import { saveDownload, clearDownloadBlob } from '../../../services/transfer-engine'
import type { TransferTask, TransferStatus } from '../../../types/sftp'
import { getTransferHistoryPage, type TransferHistoryEntry } from '../../../api/client'

type TabKey = 'all' | 'active' | 'queued' | 'paused' | 'failed' | 'done'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'queued', label: '队列中' },
  { key: 'paused', label: '已暂停' },
  { key: 'failed', label: '失败' },
  { key: 'done', label: '已完成' },
]

function matchTab(status: TransferStatus, tab: TabKey): boolean {
  if (tab === 'all') return true
  if (tab === 'done') return status === 'completed' || status === 'cancelled'
  return status === tab
}

function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function ProgressBar({ task }: { task: TransferTask }) {
  const pct = task.fileSize > 0
    ? Math.min(100, Math.round((task.bytesTransferred / task.fileSize) * 100))
    : 0
  const failed = task.status === 'failed'
  return (
    <div className="h-[3px] w-full rounded-full bg-border/60 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${failed ? 'bg-red-400' : 'bg-primary'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
function TaskRow({ task }: { task: TransferTask }) {
  const { pause, resume, cancel, retry, remove } = useTransferStore.getState()
  const isActive = task.status === 'active'
  const isPaused = task.status === 'paused'
  const isQueued = task.status === 'queued'
  const isFailed = task.status === 'failed'
  const isDone = task.status === 'completed' || task.status === 'cancelled'
  const pct = task.fileSize > 0 ? Math.round((task.bytesTransferred / task.fileSize) * 100) : 0

  return (
    <div className="px-3 py-2 hover:bg-bg-hover/50 transition-colors group">
      <div className="flex items-center gap-2 mb-1">
        <AppIcon
          icon={task.type === 'upload' ? icons.upload : icons.download}
          size={13}
          className={task.type === 'upload' ? 'text-emerald-400' : 'text-blue-400'}
        />
        <span className="flex-1 text-[12px] text-text-1 truncate" title={task.fileName}>
          {task.fileName}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {(isActive || isQueued) && (
            <button className="p-0.5 rounded hover:bg-bg-active" onClick={() => pause(task.id)} title="暂停">
              <AppIcon icon={icons.pause} size={11} className="text-text-3" />
            </button>
          )}
          {isPaused && (
            <button className="p-0.5 rounded hover:bg-bg-active" onClick={() => resume(task.id)} title="恢复">
              <AppIcon icon={icons.play} size={11} className="text-text-3" />
            </button>
          )}
          {isFailed && (
            <button className="p-0.5 rounded hover:bg-bg-active" onClick={() => retry(task.id)} title="重试">
              <AppIcon icon={icons.refresh} size={11} className="text-text-3" />
            </button>
          )}
          {!isDone && (
            <button className="p-0.5 rounded hover:bg-bg-active" onClick={() => cancel(task.id)} title="取消">
              <AppIcon icon={icons.close} size={11} className="text-text-3" />
            </button>
          )}
          {isDone && task.type === 'download' && task.status === 'completed' && (
            <button className="p-0.5 rounded hover:bg-bg-active" onClick={() => saveDownload(task.id)} title="保存到本地">
              <AppIcon icon={icons.save} size={11} className="text-primary" />
            </button>
          )}
          {isDone && (
            <button className="p-0.5 rounded hover:bg-bg-active" onClick={() => { clearDownloadBlob(task.id); remove(task.id) }} title="移除">
              <AppIcon icon={icons.trash} size={11} className="text-text-3" />
            </button>
          )}
        </div>
      </div>
      <ProgressBar task={task} />
      <div className="flex items-center justify-between mt-0.5 text-[10px] text-text-3">
        <span className="tabular-nums">{formatSize(task.bytesTransferred)} / {formatSize(task.fileSize)} ({pct}%)</span>
        <span>
          {isActive && task.speed > 0 && formatSpeed(task.speed)}
          {isPaused && '已暂停'}
          {isFailed && <span className="text-red-400">{task.error || '失败'}</span>}
          {task.status === 'completed' && '完成'}
          {task.status === 'cancelled' && '已取消'}
          {isQueued && '排队中'}
        </span>
      </div>
    </div>
  )
}

function mapHistoryEntryToTask(entry: TransferHistoryEntry): TransferTask {
  const normalizedStatus: TransferStatus = entry.status === 'canceled' ? 'cancelled' : entry.status
  const fileName = entry.remotePath.split('/').filter(Boolean).at(-1) || entry.remotePath
  const ts = Date.parse(entry.createdAt)
  return {
    id: entry.transferId,
    type: entry.direction,
    fileName,
    remotePath: entry.remotePath,
    fileSize: Math.max(0, entry.fileSize || 0),
    bytesTransferred: Math.max(0, entry.bytesTransferred || 0),
    status: normalizedStatus,
    connectionId: 'history',
    connectionName: 'History',
    speed: 0,
    error: entry.errorMessage || undefined,
    startedAt: Number.isFinite(ts) ? ts : undefined,
    completedAt: Number.isFinite(ts) ? ts : undefined,
  }
}

export default function TransferPopover() {
  const pageSize = 80
  const tasks = useTransferStore(s => s.tasks)
  const clearCompleted = useTransferStore(s => s.clearCompleted)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [historyTasks, setHistoryTasks] = useState<TransferTask[]>([])
  const [historyBeforeId, setHistoryBeforeId] = useState<number | undefined>(undefined)
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const sessionKeyFilter = useSftpStore((s) => s.bridgeSessionKey || undefined)

  useEffect(() => {
    let disposed = false
    const loadFirstPage = async () => {
      setHistoryLoading(true)
      try {
        const rows = await getTransferHistoryPage({ sessionKey: sessionKeyFilter, limit: pageSize })
        if (disposed) return
        const mapped = rows.map(mapHistoryEntryToTask)
        setHistoryTasks(mapped)
        setHistoryBeforeId(rows.length > 0 ? rows[rows.length - 1].id : undefined)
        setHistoryHasMore(rows.length >= pageSize)
      } catch {
        if (!disposed) {
          setHistoryTasks([])
          setHistoryHasMore(false)
        }
      } finally {
        if (!disposed) setHistoryLoading(false)
      }
    }
    void loadFirstPage()
    const timer = window.setInterval(() => { void loadFirstPage() }, 12_000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [sessionKeyFilter])

  const loadMoreHistory = async () => {
    if (!historyHasMore || historyLoading) return
    setHistoryLoading(true)
    try {
      const rows = await getTransferHistoryPage({
        sessionKey: sessionKeyFilter,
        limit: pageSize,
        beforeId: historyBeforeId,
      })
      const mapped = rows.map(mapHistoryEntryToTask)
      setHistoryTasks((prev) => {
        const dedup = new Map(prev.map((item) => [item.id, item]))
        for (const task of mapped) {
          if (!dedup.has(task.id)) dedup.set(task.id, task)
        }
        return Array.from(dedup.values()).sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
      })
      setHistoryBeforeId(rows.length > 0 ? rows[rows.length - 1].id : historyBeforeId)
      setHistoryHasMore(rows.length >= pageSize)
    } finally {
      setHistoryLoading(false)
    }
  }

  const mergedTasks = useMemo(() => {
    const map = new Map<string, TransferTask>()
    for (const task of tasks) map.set(task.id, task)
    for (const task of historyTasks) {
      if (!map.has(task.id)) map.set(task.id, task)
    }
    return Array.from(map.values()).sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
  }, [tasks, historyTasks])

  const filtered = useMemo(
    () => mergedTasks.filter(t => matchTab(t.status, activeTab)),
    [mergedTasks, activeTab],
  )

  const activeCount = useMemo(
    () => mergedTasks.filter(t => t.status === 'active' || t.status === 'queued').length,
    [mergedTasks],
  )

  return (
    <div className="absolute right-0 top-full mt-[12px] w-[420px] bg-bg-card/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] rounded-xl border border-border z-[250] flex flex-col overflow-hidden animate-[fade-in_0.2s_ease-out]">
      <div className="flex flex-col border-b border-border bg-bg-card/50">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="text-[14px] font-medium text-text-1">
            文件传输{activeCount > 0 && ` (${activeCount})`}
          </span>
          {tasks.some(t => t.status === 'completed') && (
            <button
              className="text-[11px] text-text-3 hover:text-primary transition-colors"
              onClick={clearCompleted}
            >
              清除已完成
            </button>
          )}
        </div>
        <div className="flex gap-4 px-4 text-[12px] text-text-3">
          {tabs.map(tab => (
            <span
              key={tab.key}
              className={`pb-2 cursor-pointer transition-colors border-b-[2px] ${
                activeTab === tab.key
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent hover:text-text-1'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </span>
          ))}
        </div>
      </div>

      <div className="h-[300px] overflow-y-auto custom-scrollbar bg-bg-card/50">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-3">
            <AppIcon icon={icons.cloudFog} size={40} className="mb-2 opacity-30" />
            <span className="text-[12px]">暂无传输任务</span>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(task => (
              <TaskRow key={task.id} task={task} />
            ))}
            {historyHasMore && (
              <div className="px-3 py-2 flex items-center justify-center">
                <button
                  className="text-[11px] text-text-3 hover:text-primary transition-colors disabled:opacity-50"
                  onClick={() => { void loadMoreHistory() }}
                  disabled={historyLoading}
                >
                  {historyLoading ? '加载中...' : '加载更多历史'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
