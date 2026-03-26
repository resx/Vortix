import { useState } from 'react'
import * as api from '../../../api/client'
import type { SshKey } from '../../../api/types'
import { AppIcon, icons } from '../../icons/AppIcon'

export function KeyPickerListView({
  keys,
  loading,
  onSelect,
  onClose,
  onEdit,
  onRefresh,
}: {
  keys: SshKey[]
  loading: boolean
  onSelect: (keyContent: string, meta?: { keyName?: string; keyId?: string }) => void
  onClose: () => void
  onEdit: (key: SshKey) => void
  onRefresh: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importName, setImportName] = useState('')
  const [importStep, setImportStep] = useState<'idle' | 'naming'>('idle')
  const [importContent, setImportContent] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDoubleClick = async (key: SshKey) => {
    try {
      const { private_key } = await api.getSshKeyPrivate(key.id)
      onSelect(private_key, { keyName: key.name, keyId: key.id })
      onClose()
    } catch {
      // ignore
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await api.deleteSshKey(id)
      onRefresh()
    } catch {
      // ignore
    } finally {
      setDeleting(null)
    }
  }

  const handleExport = (id: string) => {
    window.open(api.getSshKeyExportUrl(id), '_blank')
  }

  const handleImportFile = async () => {
    setImporting(true)
    try {
      const result = await api.pickFile('选择 SSH 密钥文件', '私钥文件|*.pem;*.key;*.ppk;*.pub|所有文件|*.*')
      if (result.content) {
        setImportContent(result.content.trim())
        setImportStep('naming')
      }
    } catch {
      // ignore
    } finally {
      setImporting(false)
    }
  }

  const handleImportSave = async () => {
    if (!importName.trim() || !importContent) return
    try {
      await api.createSshKey({ name: importName.trim(), private_key: importContent })
      setImportStep('idle')
      setImportName('')
      setImportContent('')
      onRefresh()
    } catch {
      // ignore
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', year: 'numeric' })
    } catch {
      return iso
    }
  }

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <AppIcon icon={icons.loader} size={18} className="animate-spin text-text-3" />
        </div>
      ) : keys.length === 0 ? (
        <div className="py-8 text-center text-[12px] text-text-3">
          还没有可用密钥，可以先生成或导入一把密钥。
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-border/50 bg-bg-subtle/30">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/50 text-text-3">
              <tr>
                <th className="px-3 py-2 font-normal">名称</th>
                <th className="px-3 py-2 font-normal">类型</th>
                <th className="px-3 py-2 font-normal">备注</th>
                <th className="px-3 py-2 font-normal">创建时间</th>
                <th className="w-24 px-3 py-2 font-normal">操作</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((row) => (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-b border-border/30 hover:bg-primary/5 ${selectedId === row.id ? 'bg-primary/10' : ''}`}
                  onClick={() => setSelectedId(row.id)}
                  onDoubleClick={() => void handleDoubleClick(row)}
                >
                  <td className="px-3 py-2 text-text-1">
                    {row.name}
                    {row.description && <span className="ml-1.5 text-[10px] text-primary/70">{row.description}</span>}
                  </td>
                  <td className="px-3 py-2 uppercase text-text-2">{row.key_type}</td>
                  <td className="max-w-[120px] truncate px-3 py-2 text-text-3">{row.remark || '-'}</td>
                  <td className="px-3 py-2 text-text-3">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onEdit(row)
                        }}
                        className="rounded p-1 text-text-3 hover:text-primary"
                        title="编辑"
                      >
                        <AppIcon icon={icons.pencil} size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleExport(row.id)
                        }}
                        className="rounded p-1 text-text-3 hover:text-teal-500"
                        title="导出"
                      >
                        <AppIcon icon={icons.download} size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleDelete(row.id)
                        }}
                        disabled={deleting === row.id}
                        className="rounded p-1 text-text-3 hover:text-red-500 disabled:opacity-50"
                        title="删除"
                      >
                        {deleting === row.id
                          ? <AppIcon icon={icons.loader} size={12} className="animate-spin" />
                          : <AppIcon icon={icons.trash} size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importStep === 'naming' ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            autoFocus
            value={importName}
            onChange={(event) => setImportName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void handleImportSave()}
            placeholder="给密钥起个名字..."
            className="flex-1 rounded-lg border border-border/60 bg-bg-base px-3 py-1.5 text-xs text-text-1 placeholder:text-text-3 focus:border-primary/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleImportSave()}
            disabled={!importName.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            保存
          </button>
          <button
            type="button"
            onClick={() => {
              setImportStep('idle')
              setImportContent('')
            }}
            className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-text-2"
          >
            取消
          </button>
        </div>
      ) : (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void handleImportFile()}
            disabled={importing}
            className="flex items-center gap-1 text-xs font-medium text-teal-500 hover:text-teal-600 disabled:opacity-50"
          >
            {importing
              ? <AppIcon icon={icons.loader} size={12} className="animate-spin" />
              : <AppIcon icon={icons.fileText} size={12} />}
            从文件导入
          </button>
        </div>
      )}
    </>
  )
}
