/* ── 选择预设账号密码弹窗（支持独立回调 + 编辑/删除） ── */

import { useState, useEffect } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import IslandModal from '../../ui/island-modal'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import { useToastStore } from '../../../stores/useToastStore'
import * as api from '../../../api/client'
import type { PresetPublic } from '../../../api/types'

interface SelectPresetModalProps {
  /** 独立模式回调：选中后返回 presetId */
  onSelect?: (presetId: string) => void
  /** 独立模式关闭回调 */
  onClose?: () => void
  /** 独立模式：打开新建/编辑弹窗 */
  onManage?: (editId?: string) => void
}

export default function SelectPresetModal({ onSelect, onClose, onManage }: SelectPresetModalProps = {}) {
  const toggleSubModal = useSshConfigStore((s) => s.toggleSubModal)
  const setField = useSshConfigStore((s) => s.setField)
  const { addToast } = useToastStore()

  const [presets, setPresets] = useState<PresetPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<PresetPublic | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadPresets = () => {
    setLoading(true)
    api.getPresets()
      .then(setPresets)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPresets() }, [])

  const close = () => {
    if (onClose) { onClose(); return }
    toggleSubModal('selectPreset', false)
  }

  const handleSelect = (preset: PresetPublic) => {
    if (onSelect) { onSelect(preset.id); return }
    setField('presetId', preset.id)
    setField('presetName', preset.name)
    toggleSubModal('selectPreset', false)
  }

  const handleNew = () => {
    if (onManage) { onManage(); return }
    toggleSubModal('selectPreset', false)
    toggleSubModal('managePreset', true)
  }

  const handleEdit = (e: React.MouseEvent, preset: PresetPublic) => {
    e.stopPropagation()
    if (onManage) { onManage(preset.id); return }
    toggleSubModal('selectPreset', false)
    toggleSubModal('managePreset', true)
  }

  const handleDelete = (e: React.MouseEvent, preset: PresetPublic) => {
    e.stopPropagation()
    setDeleteTarget(preset)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deletePreset(deleteTarget.id)
      addToast('success', '预设已删除')
      setDeleteTarget(null)
      loadPresets()
    } catch (err) {
      addToast('error', (err as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
    <IslandModal
      title="请选择预设账号密码"
      isOpen
      onClose={close}
      width="max-w-lg"
      padding="p-4"
      footer={
        <div className="w-full flex justify-end space-x-3">
          <button onClick={close} className="text-xs text-orange-500 hover:text-orange-600">取消</button>
          <button onClick={handleNew} className="text-xs text-teal-500 hover:text-teal-600 font-medium">新建</button>
        </div>
      }
    >
      <div className="text-[11px] text-text-3 mb-2">双击选择预设账号密码</div>
      <table className="w-full text-xs text-left mb-2 border-b border-border/50">
        <thead className="text-text-3">
          <tr>
            <th className="px-3 py-2 font-normal">名称</th>
            <th className="px-3 py-2 font-normal">用户名</th>
            <th className="px-3 py-2 font-normal">更新时间</th>
            <th className="px-3 py-2 font-normal w-[72px]">操作</th>
          </tr>
        </thead>
        <tbody>
          {presets.map((p) => (
            <tr
              key={p.id}
              className="hover:bg-bg-hover cursor-pointer transition-colors"
              onDoubleClick={() => handleSelect(p)}
            >
              <td className="px-3 py-2 text-text-1">{p.name}</td>
              <td className="px-3 py-2 text-text-2">{p.username}</td>
              <td className="px-3 py-2 text-text-3">{p.updated_at.replace('T', ' ').slice(0, 16)}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <button onClick={(e) => handleEdit(e, p)} className="text-text-3 hover:text-primary transition-colors" title="编辑">
                    <AppIcon icon={icons.edit} size={13} />
                  </button>
                  <button onClick={(e) => handleDelete(e, p)} className="text-text-3 hover:text-red-500 transition-colors" title="删除">
                    <AppIcon icon={icons.close} size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && presets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-text-3">
          <AppIcon icon={icons.cloudSun} size={52} className="mb-3" />
          <p className="text-xs">暂无数据</p>
        </div>
      )}
      {loading && (
        <div className="flex justify-center py-10 text-text-3">
          <p className="text-xs">加载中...</p>
        </div>
      )}
    </IslandModal>

    {/* 删除确认弹窗 */}
    {deleteTarget && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
        <div className="bg-bg-card rounded-xl shadow-2xl border border-border/60 w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
          <div className="flex items-start gap-3 px-5 pt-5 pb-3">
            <div className="w-8 h-8 rounded-full bg-[#FFD666]/15 flex items-center justify-center shrink-0 mt-0.5">
              <AppIcon icon={icons.alertTriangle} size={16} className="text-[#E6A23C]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-text-1 mb-1">确认删除？</div>
              <div className="text-[12px] text-text-2 leading-relaxed">确定删除预设「{deleteTarget.name}」？此操作不可撤销。</div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3.5">
            <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-3.5 py-1.5 bg-bg-base text-text-2 rounded-lg text-[12px] font-medium hover:bg-border transition-colors">取消</button>
            <button onClick={confirmDelete} disabled={deleting} className="px-3.5 py-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity">
              {deleting ? '删除中...' : '确认删除'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
