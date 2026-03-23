import { useCallback, useEffect, useRef, useState } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import IslandModal from '../ui/island-modal'
import { useUIStore } from '../../stores/useUIStore'
import { useLocalTerminalConfigStore } from '../../stores/useLocalTerminalConfigStore'
import type { ShellType } from '../../stores/useLocalTerminalConfigStore'
import * as api from '../../api/client'

const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-green-500', 'bg-cyan-500', 'bg-blue-500', 'bg-purple-500', 'bg-gray-500']

const shellOptions: ShellType[] = ['cmd', 'bash', 'powershell', 'powershell7', 'wsl', 'zsh', 'fish']

const inputClass = 'w-full bg-bg-base border border-transparent rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder-text-3 text-text-1'
const labelClass = 'block text-xs text-text-2 mb-1.5'

function errorInputClass(hasError: boolean) {
  return hasError
    ? 'w-full bg-bg-base border border-red-300 rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-red-400 focus:ring-1 focus:ring-red-300 transition-all placeholder-text-3 text-text-1'
    : inputClass
}

export default function LocalTerminalConfigDialog() {
  const closeLocalTermConfig = useUIStore((s) => s.closeLocalTermConfig)
  const mode = useUIStore((s) => s.localTermConfigMode)
  const initialId = useUIStore((s) => s.localTermConfigInitialId)

  const store = useLocalTerminalConfigStore()
  const { saving, loading, errors, testing, testResult } = store

  const [shellOpen, setShellOpen] = useState(false)
  const [pickingDir, setPickingDir] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const shellFillReqRef = useRef(0)

  // 稳定引用：避免 useEffect 依赖整个 store 导致无限循环
  const loadFromConnection = useLocalTerminalConfigStore((s) => s.loadFromConnection)
  const reset = useLocalTerminalConfigStore((s) => s.reset)

  const autoFillWorkingDir = useCallback(async (shell: ShellType) => {
    const requestId = ++shellFillReqRef.current
    try {
      const defaultDir = await api.getLocalTerminalDefaultDir(shell)
      if (shellFillReqRef.current !== requestId) return
      if (useLocalTerminalConfigStore.getState().shell !== shell) return
      useLocalTerminalConfigStore.getState().setField('workingDir', defaultDir || '')
    } catch {
      // ignore auto-fill failures
    }
  }, [])

  // mount 时加载编辑数据 / unmount 时重置
  useEffect(() => {
    if (mode === 'edit' && initialId) {
      loadFromConnection(initialId)
    } else {
      void autoFillWorkingDir(useLocalTerminalConfigStore.getState().shell)
    }
    return () => { reset() }
  }, [autoFillWorkingDir, initialId, mode, loadFromConnection, reset])

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShellOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handlePickDir = async () => {
    setPickingDir(true)
    try {
      const selected = await api.pickDir(store.workingDir || undefined)
      if (selected) store.setField('workingDir', selected)
    } catch { /* 静默 */ }
    setPickingDir(false)
  }

  const footer = (
    <>
      <button
        className={`text-xs font-medium transition-colors ${
          testResult
            ? testResult.success
              ? 'text-green-500'
              : 'text-red-500'
            : 'text-primary hover:opacity-80'
        }`}
        onClick={() => store.testConnection()}
        disabled={saving || loading || testing}
      >
        {testing ? '测试中...' : testResult ? (testResult.success ? `✓ ${testResult.message}` : `✗ ${testResult.message}`) : '测试连接'}
      </button>
      <button
        className={`text-xs font-medium transition-colors ${saving || loading ? 'text-text-disabled cursor-not-allowed' : 'text-primary hover:opacity-80'}`}
        onClick={() => store.save()}
        disabled={saving || loading}
      >
        {saving ? '保存中...' : loading ? '加载中...' : '保存'}
      </button>
    </>
  )
  return (
    <IslandModal
      title="终端配置编辑"
      isOpen={true}
      onClose={closeLocalTermConfig}
      footer={footer}
      width="max-w-[520px]"
      padding="px-7 py-5"
    >
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 animate-in fade-in duration-200">
        {/* 颜色标签 */}
        <div>
          <label className={labelClass}>颜色标签</label>
          <div className="flex items-center space-x-2 mt-1">
            {colors.map((c, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full ${c} cursor-pointer hover:scale-110 transition-transform ${store.colorTag === c ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                onClick={() => store.setField('colorTag', store.colorTag === c ? null : c)}
              />
            ))}
            <button
              className="text-text-3 hover:text-text-2 ml-1"
              onClick={() => store.setField('colorTag', null)}
            >
              <AppIcon icon={icons.close} size={14} />
            </button>
          </div>
        </div>

        {/* 名称 */}
        <div>
          <label className={`block text-xs mb-1.5 ${errors.name ? 'text-red-500' : 'text-text-2'}`}>名称</label>
          <input
            type="text"
            value={store.name}
            onChange={(e) => store.setField('name', e.target.value)}
            className={errorInputClass(!!errors.name)}
          />
          {errors.name && <p className="text-red-500 text-[11px] mt-1">{errors.name}</p>}
        </div>
        {/* Shell 下拉 */}
        <div className="col-span-2 relative" ref={dropdownRef}>
          <label className={labelClass}>Shell</label>
          <div
            onClick={() => setShellOpen(!shellOpen)}
            className={`w-full h-[30px] bg-bg-base rounded px-2.5 flex items-center justify-between cursor-pointer transition-all text-xs
              ${shellOpen ? 'border border-primary ring-1 ring-primary/20 bg-bg-card' : 'border border-transparent hover:bg-bg-hover'}`}
          >
            <span className="font-mono text-text-1">{store.shell}</span>
            <AppIcon icon={icons.chevronDown} size={12} className="text-text-3" />
          </div>
          {shellOpen && (
            <div className="absolute top-full left-0 w-full mt-1 bg-bg-card border border-border rounded-lg shadow-lg z-10 py-1 max-h-48 overflow-y-auto">
              {shellOptions.map((opt) => (
                <div
                  key={opt}
                  onClick={() => {
                    store.setField('shell', opt)
                    setShellOpen(false)
                    void autoFillWorkingDir(opt)
                  }}
                  className={`px-2.5 py-1.5 text-xs font-mono cursor-pointer transition-colors
                    ${store.shell === opt ? 'text-primary bg-primary/5' : 'text-text-1 hover:bg-bg-hover'}`}
                >
                  {opt}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 工作路径 */}
        <div className="col-span-2">
          <label className={labelClass}>工作路径</label>
          <div className="flex items-center w-full h-[30px] bg-bg-base border border-transparent rounded overflow-hidden focus-within:bg-bg-card focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <input
              type="text"
              value={store.workingDir}
              onChange={(e) => store.setField('workingDir', e.target.value)}
              placeholder="例如: D:\\Projects"
              className="flex-1 h-full bg-transparent px-2.5 text-xs outline-none placeholder-text-3 text-text-1 font-mono"
            />
            <button
              type="button"
              className={`h-full px-2.5 flex items-center justify-center transition-colors ${pickingDir ? 'text-primary animate-pulse' : 'text-text-3 hover:text-primary hover:bg-primary/5'}`}
              title="选择文件夹"
              onClick={handlePickDir}
              disabled={pickingDir}
            >
              <AppIcon icon={icons.folder} size={14} />
            </button>
          </div>
        </div>
        {/* 初始执行命令 */}
        <div className="col-span-2">
          <label className={labelClass}>初始执行命令</label>
          <input
            type="text"
            value={store.initialCommand}
            onChange={(e) => store.setField('initialCommand', e.target.value)}
            className={`${inputClass} font-mono`}
          />
        </div>

        {/* 备注 */}
        <div className="col-span-2">
          <label className={labelClass}>备注</label>
          <input
            type="text"
            value={store.remark}
            onChange={(e) => store.setField('remark', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
    </IslandModal>
  )
}
