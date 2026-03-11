/* ── 预设账号密码管理弹窗（创建 + 编辑 + 删除） ── */

import { useState, useEffect, useCallback } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import IslandModal from '../../ui/island-modal'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import { useToastStore } from '../../../stores/useToastStore'
import * as api from '../../../api/client'

const inputClass = 'w-full bg-bg-base border border-transparent rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder-text-3 text-text-1'
const labelClass = 'block text-xs text-text-2 mb-1.5'

interface ManagePresetModalProps {
  editId?: string | null
  onClose?: () => void
  onSaved?: () => void
}

export default function ManagePresetModal({ editId, onClose, onSaved }: ManagePresetModalProps = {}) {
  const toggleSubModal = useSshConfigStore((s) => s.toggleSubModal)
  const { addToast } = useToastStore()

  const isEdit = !!editId
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remark, setRemark] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [touched, setTouched] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    if (!editId) return
    setLoadingEdit(true)
    Promise.all([
      api.getPresets().then(list => list.find(p => p.id === editId)),
      api.getPresetCredential(editId),
    ]).then(([preset, cred]) => {
      if (preset) { setName(preset.name); setUsername(preset.username); setRemark(preset.remark || '') }
      if (cred) setPassword(cred.password)
    }).catch(() => {
      addToast('error', '加载预设失败')
    }).finally(() => setLoadingEdit(false))
  }, [editId, addToast])

  const close = useCallback(() => {
    if (onClose) { onClose(); return }
    toggleSubModal('managePreset', false)
  }, [onClose, toggleSubModal])

  const canSave = name.trim() && username.trim() && password.trim()

  const handleSave = async () => {
    setTouched(true)
    if (!canSave) return
    setSaving(true)
    try {
      if (isEdit) {
        await api.updatePreset(editId!, { name: name.trim(), username: username.trim(), password, remark: remark.trim() })
        addToast('success', '预设已更新')
      } else {
        await api.createPreset({ name: name.trim(), username: username.trim(), password, remark: remark.trim() })
        addToast('success', '预设创建成功')
      }
      onSaved?.()
      close()
    } catch (e) {
      addToast('error', (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editId) return
    setSaving(true)
    try {
      await api.deletePreset(editId)
      addToast('success', '预设已删除')
      onSaved?.()
      close()
    } catch (e) {
      addToast('error', (e as Error).message)
    } finally {
      setSaving(false)
      setConfirmingDelete(false)
    }
  }

  return (
    <>
    <IslandModal
      title={isEdit ? '编辑预设账号密码' : '新建预设账号密码'}
      isOpen
      onClose={close}
      width="max-w-lg"
      padding="p-4"
      footer={
        <div className="w-full flex justify-between">
          <div>
            {isEdit && (
              <button onClick={() => setConfirmingDelete(true)} disabled={saving} className="text-xs text-red-500 hover:text-red-600">删除</button>
            )}
          </div>
          <div className="flex space-x-3">
            <button onClick={close} className="text-xs text-orange-500 hover:text-orange-600">取消</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`text-xs font-medium ${!saving ? 'text-primary hover:opacity-80' : 'text-primary/40 cursor-not-allowed'}`}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      }
    >
      {loadingEdit ? (
        <div className="flex justify-center py-10 text-text-3"><p className="text-xs">加载中...</p></div>
      ) : (
        <>
          <div className="text-[11px] text-text-3 mb-5">预存的账号密码对，可在 SSH 配置中引用</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className={labelClass}>名称 <span className="text-red-500">*</span></label>
              <input type="text" className={`${inputClass} ${touched && !name.trim() ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="预设名称" />
            </div>
            <div>
              <label className={labelClass}>用户名 <span className="text-red-500">*</span></label>
              <input type="text" className={`${inputClass} ${touched && !username.trim() ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : ''}`} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="SSH 用户名" />
            </div>
            <div>
              <label className={labelClass}>密码 <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} className={`${inputClass} pr-8 ${touched && !password.trim() ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : ''}`} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="SSH 密码" />
                <button onClick={() => setShowPwd(!showPwd)} className="absolute right-2.5 top-1.5 text-text-3 hover:text-text-2">
                  {showPwd ? <AppIcon icon={icons.eye} size={16} /> : <AppIcon icon={icons.eyeOff} size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>备注</label>
              <input type="text" className={inputClass} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="可选" />
            </div>
          </div>
        </>
      )}
    </IslandModal>

    {/* 删除确认弹窗 */}
    {confirmingDelete && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
        <div className="bg-bg-card rounded-xl shadow-2xl border border-border/60 w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
          <div className="flex items-start gap-3 px-5 pt-5 pb-3">
            <div className="w-8 h-8 rounded-full bg-[#FFD666]/15 flex items-center justify-center shrink-0 mt-0.5">
              <AppIcon icon={icons.alertTriangle} size={16} className="text-[#E6A23C]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-text-1 mb-1">确认删除？</div>
              <div className="text-[12px] text-text-2 leading-relaxed">确定删除预设「{name}」？此操作不可撤销。</div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3.5">
            <button onClick={() => setConfirmingDelete(false)} disabled={saving} className="px-3.5 py-1.5 bg-bg-base text-text-2 rounded-lg text-[12px] font-medium hover:bg-border transition-colors">取消</button>
            <button onClick={handleDelete} disabled={saving} className="px-3.5 py-1.5 bg-red-500 text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity">
              {saving ? '删除中...' : '确认删除'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
