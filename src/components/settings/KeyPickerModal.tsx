/* ── 密钥管理器（密钥库模式） ── */

import { useState, useEffect, useCallback } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import IslandModal from '../ui/island-modal'
import * as api from '../../api/client'
import type { SshKey } from '../../api/types'

interface KeyPickerModalProps {
  onSelect: (keyContent: string) => void
  onClose: () => void
}

type KeyType = 'ed25519' | 'ecdsa' | 'rsa' | 'ml-dsa'
type TabView = 'list' | 'generate' | 'import' | 'edit'

const KEY_TYPE_OPTIONS: { value: KeyType; label: string; desc: string }[] = [
  { value: 'ed25519', label: 'ED25519', desc: 'OpenSSH 6.5+' },
  { value: 'ecdsa', label: 'ECDSA', desc: 'OpenSSH 5.7+' },
  { value: 'rsa', label: 'RSA', desc: 'Legacy devices' },
  { value: 'ml-dsa', label: 'ML-DSA', desc: '后量子算法' },
]

const ECDSA_BITS = [521, 384, 256]
const RSA_BITS = [4096, 2048, 1024]
const MLDSA_BITS = [87, 65, 44]
const DEFAULT_BITS_BY_TYPE: Record<KeyType, number> = {
  ed25519: 521,
  ecdsa: 521,
  rsa: 4096,
  'ml-dsa': 87,
}

export default function KeyPickerModal({ onSelect, onClose }: KeyPickerModalProps) {
  const [tab, setTab] = useState<TabView>('list')
  const [keys, setKeys] = useState<SshKey[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<SshKey | null>(null)

  const loadKeys = useCallback(async () => {
    setLoading(true)
    try { setKeys(await api.getSshKeys()) } catch { setKeys([]) }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadKeys()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadKeys])

  const handleEdit = (key: SshKey) => { setEditingKey(key); setTab('edit') }
  const handleBackToList = () => { setTab('list'); setEditingKey(null) }

  const tabTitle = tab === 'list' ? '密钥库' : tab === 'generate' ? '新建密钥' : tab === 'import' ? '手动导入' : '编辑密钥'

  return (
    <IslandModal
      title={tabTitle}
      isOpen
      onClose={onClose}
      width="max-w-2xl"
      padding="p-0"
      footer={tab === 'list' ? <div className="text-[11px] text-text-3">双击选择密钥 · 右侧按钮编辑/导出/删除</div> : <div />}
    >
      {/* Tab 切换 */}
      <div className="flex border-b border-border/50 px-4 pt-3 gap-1">
        {tab === 'edit' ? (
          <button onClick={handleBackToList} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-3 hover:text-text-2">
            <AppIcon icon={icons.arrowLeft} size={13} /> 返回列表
          </button>
        ) : (
          <>
            {([['list', '密钥库', icons.key], ['generate', '新建密钥', icons.plus], ['import', '手动导入', icons.clipboardPaste]] as const).map(([key, label, iconId]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors ${
                  tab === key
                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                    : 'text-text-3 hover:text-text-2 hover:bg-bg-hover'
                }`}
              >
                <AppIcon icon={iconId} size={13} />
                {label}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="p-4">
        {tab === 'list' && (
          <ListView
            keys={keys}
            loading={loading}
            onSelect={onSelect}
            onClose={onClose}
            onEdit={handleEdit}
            onRefresh={loadKeys}
          />
        )}
        {tab === 'generate' && (
          <GenerateView onDone={() => { loadKeys(); setTab('list') }} />
        )}
        {tab === 'import' && (
          <ImportView onDone={() => { loadKeys(); setTab('list') }} />
        )}
        {tab === 'edit' && editingKey && (
          <EditView keyData={editingKey} onDone={() => { loadKeys(); handleBackToList() }} />
        )}
      </div>
    </IslandModal>
  )
}

/* ══════════════════════════════════════════════════
   Tab 1: 密钥库列表
   ══════════════════════════════════════════════════ */

function ListView({ keys, loading, onSelect, onClose, onEdit, onRefresh }: {
  keys: SshKey[]
  loading: boolean
  onSelect: (k: string) => void
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
      onSelect(private_key)
      onClose()
    } catch { /* 静默 */ }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try { await api.deleteSshKey(id); onRefresh() } catch { /* 静默 */ }
    setDeleting(null)
  }

  const handleExport = (id: string) => {
    window.open(api.getSshKeyExportUrl(id), '_blank')
  }

  const handleImportFile = async () => {
    setImporting(true)
    try {
      const result = await api.pickFile('选择 SSH 私钥文件', '私钥文件|*.pem;*.key;*.ppk;*.pub|所有文件|*.*')
      if (result.content) {
        setImportContent(result.content.trim())
        setImportStep('naming')
      }
    } catch { /* 静默 */ }
    setImporting(false)
  }

  const handleImportSave = async () => {
    if (!importName.trim() || !importContent) return
    try {
      await api.createSshKey({ name: importName.trim(), private_key: importContent })
      setImportStep('idle'); setImportName(''); setImportContent('')
      onRefresh()
    } catch { /* 静默 */ }
  }

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', year: 'numeric' }) } catch { return iso }
  }

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <AppIcon icon={icons.loader} size={18} className="animate-spin text-text-3" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 text-[12px] text-text-3">
          密钥库为空，请通过"新建密钥"或"导入本地文件"添加
        </div>
      ) : (
        <div className="border border-border/50 rounded overflow-hidden bg-bg-subtle/30">
          <table className="w-full text-xs text-left">
            <thead className="text-text-3 border-b border-border/50">
              <tr>
                <th className="px-3 py-2 font-normal">名称</th>
                <th className="px-3 py-2 font-normal">类型</th>
                <th className="px-3 py-2 font-normal">备注</th>
                <th className="px-3 py-2 font-normal">创建时间</th>
                <th className="px-3 py-2 font-normal w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border/30 hover:bg-primary/5 cursor-pointer ${selectedId === row.id ? 'bg-primary/10' : ''}`}
                  onClick={() => setSelectedId(row.id)}
                  onDoubleClick={() => handleDoubleClick(row)}
                >
                  <td className="px-3 py-2 text-text-1">
                    {row.name}
                    {row.description && <span className="ml-1.5 text-[10px] text-primary/70">{row.description}</span>}
                  </td>
                  <td className="px-3 py-2 text-text-2 uppercase">{row.key_type}</td>
                  <td className="px-3 py-2 text-text-3 truncate max-w-[120px]">{row.remark || '—'}</td>
                  <td className="px-3 py-2 text-text-3">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); onEdit(row) }} className="p-1 text-text-3 hover:text-primary rounded" title="编辑">
                        <AppIcon icon={icons.pencil} size={12} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleExport(row.id) }} className="p-1 text-text-3 hover:text-teal-500 rounded" title="导出">
                        <AppIcon icon={icons.download} size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(row.id) }}
                        disabled={deleting === row.id}
                        className="p-1 text-text-3 hover:text-red-500 rounded disabled:opacity-50"
                        title="删除"
                      >
                        {deleting === row.id ? <AppIcon icon={icons.loader} size={12} className="animate-spin" /> : <AppIcon icon={icons.trash} size={12} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 导入区域 */}
      {importStep === 'naming' ? (
        <div className="flex items-center gap-2 mt-3">
          <input
            autoFocus
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleImportSave()}
            placeholder="输入密钥名称..."
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 focus:outline-none focus:border-primary/60"
          />
          <button onClick={handleImportSave} disabled={!importName.trim()} className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white font-medium disabled:opacity-50">保存</button>
          <button onClick={() => { setImportStep('idle'); setImportContent('') }} className="px-3 py-1.5 text-xs rounded-lg border border-border/60 text-text-2">取消</button>
        </div>
      ) : (
        <div className="flex justify-end mt-3">
          <button
            onClick={handleImportFile}
            disabled={importing}
            className="flex items-center gap-1 text-xs text-teal-500 hover:text-teal-600 font-medium disabled:opacity-50"
          >
            {importing ? <AppIcon icon={icons.loader} size={12} className="animate-spin" /> : <AppIcon icon={icons.fileText} size={12} />}
            导入本地文件
          </button>
        </div>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════
   Tab 2: 新建密钥
   ══════════════════════════════════════════════════ */

function GenerateView({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [keyType, setKeyType] = useState<KeyType>('ed25519')
  const [bits, setBits] = useState<number>(DEFAULT_BITS_BY_TYPE.ed25519)
  const [passphrase, setPassphrase] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [comment, setComment] = useState('')
  const [generating, setGenerating] = useState(false)
  const [resultPub, setResultPub] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const needBits = keyType === 'ecdsa' || keyType === 'rsa' || keyType === 'ml-dsa'
  const bitsOptions = keyType === 'ecdsa' ? ECDSA_BITS : keyType === 'rsa' ? RSA_BITS : MLDSA_BITS

  const handleGenerate = async () => {
    if (!name.trim()) { setError('请输入密钥名称'); return }
    setGenerating(true); setError(''); setResultPub('')
    try {
      const data = await api.generateSshKey({
        name: name.trim(),
        type: keyType,
        ...(needBits && { bits }),
        ...(passphrase && { passphrase }),
        ...(comment && { comment }),
      })
      setResultPub(data.publicKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    }
    setGenerating(false)
  }

  const handleCopyPub = async () => {
    await navigator.clipboard.writeText(resultPub)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-4">
      {/* 密钥名称 */}
      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">密钥名称 *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如: my-server-key"
          className="w-full px-3 py-2 text-xs rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 focus:outline-none focus:border-primary/60"
        />
      </div>

      {/* 密钥类型 */}
      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">密钥类型</label>
        <div className="grid grid-cols-4 gap-2">
          {KEY_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setKeyType(opt.value)
                  setBits(DEFAULT_BITS_BY_TYPE[opt.value])
                  setResultPub('')
                  setError('')
                }}
                className={`px-3 py-2 rounded-lg border text-xs text-center transition-colors ${
                keyType === opt.value
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border/60 text-text-2 hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-[10px] text-text-3 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Bits */}
      {needBits && (
        <div>
          <label className="text-[11px] text-text-3 mb-1.5 block">
            {keyType === 'ecdsa' ? 'Curve Size' : keyType === 'rsa' ? 'Key Size' : 'Parameter Set'}
          </label>
          <div className="flex gap-2">
            {bitsOptions.map((b) => (
              <button
                key={b}
                onClick={() => setBits(b)}
                className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${
                  bits === b
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border/60 text-text-2 hover:border-primary/40'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 加密密码 */}
      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">加密密码（可选）</label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="留空则不加密"
            className="w-full px-3 py-2 text-xs rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 focus:outline-none focus:border-primary/60 pr-8"
          />
          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-2">
            {showPass ? <AppIcon icon={icons.eyeOff} size={14} /> : <AppIcon icon={icons.eye} size={14} />}
          </button>
        </div>
      </div>

      {/* 备注 */}
      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">备注（可选）</label>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="例如: user@hostname"
          className="w-full px-3 py-2 text-xs rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 focus:outline-none focus:border-primary/60"
        />
      </div>

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
      >
        {generating ? <AppIcon icon={icons.loader} size={13} className="animate-spin" /> : <AppIcon icon={icons.key} size={13} />}
        {generating ? '生成中...' : '生成密钥'}
      </button>

      {error && <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      {/* 生成成功：显示公钥 + 自动切回列表 */}
      {resultPub && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-3">公钥（已自动保存到密钥库）</span>
            <button onClick={handleCopyPub} className="flex items-center gap-1 text-[11px] text-text-3 hover:text-primary transition-colors">
              {copied ? <AppIcon icon={icons.check} size={11} className="text-green-500" /> : <AppIcon icon={icons.copy} size={11} />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          <textarea
            readOnly
            value={resultPub}
            rows={3}
            className="w-full px-3 py-2 text-[11px] font-mono rounded-lg border border-border/60 bg-bg-subtle/50 text-text-2 resize-none focus:outline-none custom-scrollbar"
          />
          <button
            onClick={onDone}
            className="w-full py-2 rounded-lg bg-teal-500 text-white text-xs font-medium hover:bg-teal-600 transition-colors"
          >
            返回密钥库
          </button>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════
   Tab 3: 手动导入
   ══════════════════════════════════════════════════ */

function ImportView({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [certificate, setCertificate] = useState('')
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!name.trim()) { setError('请输入密钥名称'); return }
    if (!privateKey.trim()) { setError('请粘贴私钥内容'); return }
    setSaving(true); setError('')
    try {
      await api.createSshKey({
        name: name.trim(),
        private_key: privateKey.trim(),
        public_key: publicKey.trim() || undefined,
        passphrase: passphrase || undefined,
        certificate: certificate.trim() || undefined,
        remark: remark.trim() || undefined,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">密钥名称 *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如: my-server-key"
          className="w-full px-3 py-2 text-xs rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 focus:outline-none focus:border-primary/60"
        />
      </div>

      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">私钥 *</label>
        <textarea
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          rows={4}
          placeholder="粘贴私钥内容（-----BEGIN OPENSSH PRIVATE KEY-----）..."
          className="w-full px-3 py-2 text-[11px] font-mono rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 resize-none focus:outline-none focus:border-primary/60 custom-scrollbar"
        />
      </div>

      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">公钥</label>
        <textarea
          value={publicKey}
          onChange={(e) => setPublicKey(e.target.value)}
          rows={2}
          placeholder="粘贴公钥内容（可选）..."
          className="w-full px-3 py-2 text-[11px] font-mono rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 resize-none focus:outline-none focus:border-primary/60 custom-scrollbar"
        />
      </div>

      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">加密密钥</label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="私钥的密码短语（可选）"
            className="w-full px-3 py-2 text-xs rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 focus:outline-none focus:border-primary/60 pr-8"
          />
          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-2">
            {showPass ? <AppIcon icon={icons.eyeOff} size={14} /> : <AppIcon icon={icons.eye} size={14} />}
          </button>
        </div>
      </div>

      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">证书</label>
        <textarea
          value={certificate}
          onChange={(e) => setCertificate(e.target.value)}
          rows={2}
          placeholder="粘贴证书内容（可选）..."
          className="w-full px-3 py-2 text-[11px] font-mono rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 resize-none focus:outline-none focus:border-primary/60 custom-scrollbar"
        />
      </div>

      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">备注</label>
        <input
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="备注信息（可选）..."
          className="w-full px-3 py-2 text-xs rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 focus:outline-none focus:border-primary/60"
        />
      </div>

      {error && <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
      >
        {saving ? <AppIcon icon={icons.loader} size={13} className="animate-spin" /> : <AppIcon icon={icons.clipboardPaste} size={13} />}
        {saving ? '保存中...' : '保存到密钥库'}
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════════════
   Tab 4: 编辑密钥
   ══════════════════════════════════════════════════ */

function EditView({ keyData, onDone }: { keyData: SshKey; onDone: () => void }) {
  const [name, setName] = useState(keyData.name)
  const [publicKey, setPublicKey] = useState(keyData.public_key ?? '')
  const [privateKey, setPrivateKey] = useState('')
  const [privateKeyLoaded, setPrivateKeyLoaded] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [certificate, setCertificate] = useState(keyData.certificate ?? '')
  const [remark, setRemark] = useState(keyData.remark)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 加载私钥明文
  useEffect(() => {
    api.getSshKeyPrivate(keyData.id)
      .then(({ private_key }) => { setPrivateKey(private_key); setPrivateKeyLoaded(true) })
      .catch(() => setPrivateKeyLoaded(true))
  }, [keyData.id])

  const handleSave = async () => {
    if (!name.trim()) { setError('名称不能为空'); return }
    setSaving(true); setError('')
    try {
      await api.updateSshKey(keyData.id, {
        name: name.trim(),
        public_key: publicKey || null,
        ...(privateKey && { private_key: privateKey }),
        passphrase: passphrase || null,
        certificate: certificate || null,
        remark,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      {/* 名称 */}
      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">密钥名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg border border-border/60 bg-bg-base text-text-1 focus:outline-none focus:border-primary/60"
        />
      </div>

      {/* 类型（只读） */}
      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">密钥类型</label>
        <div className="px-3 py-2 text-xs rounded-lg border border-border/40 bg-bg-subtle/50 text-text-2 uppercase">{keyData.key_type}</div>
      </div>

      {/* 私钥 */}
      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">私钥</label>
        {!privateKeyLoaded ? (
          <div className="flex items-center gap-1.5 py-2 text-xs text-text-3"><AppIcon icon={icons.loader} size={12} className="animate-spin" /> 加载中...</div>
        ) : (
          <textarea
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            rows={4}
            placeholder="粘贴私钥内容..."
            className="w-full px-3 py-2 text-[11px] font-mono rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 resize-none focus:outline-none focus:border-primary/60 custom-scrollbar"
          />
        )}
      </div>

      {/* 公钥 */}
      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">公钥</label>
        <textarea
          value={publicKey}
          onChange={(e) => setPublicKey(e.target.value)}
          rows={3}
          placeholder="粘贴公钥内容..."
          className="w-full px-3 py-2 text-[11px] font-mono rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 resize-none focus:outline-none focus:border-primary/60 custom-scrollbar"
        />
      </div>

      {/* 加密密钥（密码短语） */}
      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">加密密钥</label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder={keyData.has_passphrase ? '已设置（留空保持不变，输入新值覆盖）' : '未设置'}
            className="w-full px-3 py-2 text-xs rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 focus:outline-none focus:border-primary/60 pr-8"
          />
          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-2">
            {showPass ? <AppIcon icon={icons.eyeOff} size={14} /> : <AppIcon icon={icons.eye} size={14} />}
          </button>
        </div>
      </div>

      {/* 证书 */}
      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">证书</label>
        <textarea
          value={certificate}
          onChange={(e) => setCertificate(e.target.value)}
          rows={3}
          placeholder="粘贴证书内容（可选）..."
          className="w-full px-3 py-2 text-[11px] font-mono rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 resize-none focus:outline-none focus:border-primary/60 custom-scrollbar"
        />
      </div>

      {/* 备注 */}
      <div>
        <label className="text-[11px] text-text-3 mb-1.5 block">备注</label>
        <input
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="备注信息..."
          className="w-full px-3 py-2 text-xs rounded-lg border border-border/60 bg-bg-base text-text-1 placeholder:text-text-3 focus:outline-none focus:border-primary/60"
        />
      </div>

      {error && <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
      >
        {saving ? <AppIcon icon={icons.loader} size={13} className="animate-spin" /> : null}
        {saving ? '保存中...' : '保存修改'}
      </button>
    </div>
  )
}
