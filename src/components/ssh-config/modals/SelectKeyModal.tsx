/* ── 选择私钥弹窗（支持独立回调模式） ── */

import { useState, useEffect } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import IslandModal from '../../ui/island-modal'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import * as api from '../../../api/client'
import type { SshKey } from '../../../api/types'

const formatLocalDateTime = (value: string | null | undefined): string => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.replace('T', ' ').replace('Z', '').slice(0, 16)
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

interface SelectKeyModalProps {
  /** 独立模式回调：选中后返回 keyId + keyName */
  onSelect?: (keyId: string, keyName: string) => void
  /** 独立模式关闭回调 */
  onClose?: () => void
}

export default function SelectKeyModal({ onSelect, onClose }: SelectKeyModalProps = {}) {
  const toggleSubModal = useSshConfigStore((s) => s.toggleSubModal)
  const setField = useSshConfigStore((s) => s.setField)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [keys, setKeys] = useState<SshKey[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSshKeys()
      .then(setKeys)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const close = () => {
    if (onClose) { onClose(); return }
    toggleSubModal('selectKey', false)
  }

  const authType = useSshConfigStore((s) => s.authType)

  const handleConfirm = () => {
    if (!selectedId) { close(); return }
    const key = keys.find((k) => k.id === selectedId)
    if (key) {
      if (onSelect) { onSelect(key.id, key.name); return }
      if (authType === 'jump') {
        setField('jumpKeyId', key.id)
        setField('jumpKeyName', key.name)
      } else {
        setField('privateKeyId', key.id)
        setField('privateKeyName', key.name)
      }
    }
    toggleSubModal('selectKey', false)
  }

  const openImport = () => {
    if (onClose) { onClose(); return }
    toggleSubModal('selectKey', false)
    toggleSubModal('importKey', true)
  }

  return (
    <IslandModal
      title="请选择私钥"
      isOpen
      onClose={close}
      width="max-w-lg"
      padding="p-4"
      footer={
        <>
          <div className="text-[11px] text-text-3">双击或者回车选择私钥</div>
          <div className="space-x-3">
            <button onClick={close} className="text-xs text-orange-500 hover:text-orange-600">取消</button>
            {!onSelect && <button onClick={openImport} className="text-xs text-teal-500 hover:text-teal-600 font-medium">新建</button>}
          </div>
        </>
      }
    >
      <div className="text-[11px] text-text-3 mb-2">双击或者回车选择私钥</div>
      <div className="border border-border/50 rounded overflow-hidden bg-bg-subtle/30">
        <table className="w-full text-xs text-left">
          <thead className="text-text-3 border-b border-border/50">
            <tr>
              <th className="px-3 py-2 font-normal">名称</th>
              <th className="px-3 py-2 font-normal">类型</th>
              <th className="px-3 py-2 font-normal">备注</th>
              <th className="px-3 py-2 font-normal">创建时间</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-border/30 hover:bg-primary/5 cursor-pointer ${selectedId === row.id ? 'bg-primary/5' : ''}`}
                onClick={() => setSelectedId(row.id)}
                onDoubleClick={() => { setSelectedId(row.id); setTimeout(handleConfirm, 0) }}
              >
                <td className="px-3 py-2 text-text-1">{row.name}</td>
                <td className="px-3 py-2 text-text-2">{row.key_type}</td>
                <td className="px-3 py-2 text-text-3 max-w-[120px] truncate">{row.remark || '-'}</td>
                <td className="px-3 py-2 text-text-3">{formatLocalDateTime(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && keys.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-text-3">
          <AppIcon icon={icons.cloudSun} size={52} className="mb-3" />
          <p className="text-xs">暂无私钥，请先在设置中导入</p>
        </div>
      )}
      {loading && (
        <div className="flex justify-center py-10 text-text-3">
          <p className="text-xs">加载中...</p>
        </div>
      )}
    </IslandModal>
  )
}
