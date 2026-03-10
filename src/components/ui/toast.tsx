import { useEffect } from 'react'
import { useToastStore, type ToastItem } from '../../stores/useToastStore'
import { AppIcon, icons } from '../icons/AppIcon'

function Toast({ id, type, message, onClose }: ToastItem & { onClose: () => void }) {
  useEffect(() => {
    const ms = type === 'error' ? 5000 : 3000
    const timer = setTimeout(onClose, ms)
    return () => clearTimeout(timer)
  }, [type, onClose])

  return (
    <div className="flex items-start gap-2.5 px-4 py-3 bg-bg-card border border-border/60 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 max-w-[420px]">
      {type === 'success'
        ? <AppIcon icon={icons.checkCircle} size={16} className="shrink-0 mt-0.5 text-chart-green" />
        : <AppIcon icon={icons.alertTriangle} size={16} className="shrink-0 mt-0.5 text-status-error" />
      }
      <span className="text-[12px] text-text-1 break-all whitespace-pre-wrap min-w-0">{message}</span>
      <button onClick={onClose} className="shrink-0 p-0.5 rounded hover:bg-bg-base transition-colors">
        <AppIcon icon={icons.close} size={12} className="text-text-3" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-2 pointer-events-auto">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  )
}
