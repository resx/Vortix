import { useEffect, useState } from 'react'
import * as api from '../../../api/client'
import type { SshKey } from '../../../api/types'
import { AppIcon, icons } from '../../icons/AppIcon'

export function KeyPickerEditView({
  keyData,
  onDone,
}: {
  keyData: SshKey
  onDone: () => void
}) {
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

  useEffect(() => {
    api.getSshKeyPrivate(keyData.id)
      .then(({ private_key }) => {
        setPrivateKey(private_key)
        setPrivateKeyLoaded(true)
      })
      .catch(() => setPrivateKeyLoaded(true))
  }, [keyData.id])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('请输入名称')
      return
    }
    setSaving(true)
    setError('')
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
    } catch (error) {
      setError(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] text-text-3">密钥名称</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-lg border border-border/60 bg-bg-base px-3 py-2 text-xs text-text-1 focus:border-primary/60 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-text-3">算法类型</label>
        <div className="rounded-lg border border-border/40 bg-bg-subtle/50 px-3 py-2 text-xs uppercase text-text-2">
          {keyData.key_type}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-text-3">私钥</label>
        {!privateKeyLoaded ? (
          <div className="flex items-center gap-1.5 py-2 text-xs text-text-3">
            <AppIcon icon={icons.loader} size={12} className="animate-spin" />
            加载中...
          </div>
        ) : (
          <textarea
            value={privateKey}
            onChange={(event) => setPrivateKey(event.target.value)}
            rows={4}
            placeholder="粘贴私钥内容..."
            className="custom-scrollbar w-full resize-none rounded-lg border border-border/60 bg-bg-base px-3 py-2 font-mono text-[11px] text-text-1 placeholder:text-text-3 focus:border-primary/60 focus:outline-none"
          />
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-text-3">公钥</label>
        <textarea
          value={publicKey}
          onChange={(event) => setPublicKey(event.target.value)}
          rows={3}
          placeholder="粘贴公钥内容..."
          className="custom-scrollbar w-full resize-none rounded-lg border border-border/60 bg-bg-base px-3 py-2 font-mono text-[11px] text-text-1 placeholder:text-text-3 focus:border-primary/60 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-text-3">口令</label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder={keyData.has_passphrase ? '留空表示保持现状，填写则更新口令' : '可选'}
            className="w-full rounded-lg border border-border/60 bg-bg-base px-3 py-2 pr-8 text-xs text-text-1 placeholder:text-text-3 focus:border-primary/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPass((current) => !current)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-2"
          >
            {showPass ? <AppIcon icon={icons.eyeOff} size={14} /> : <AppIcon icon={icons.eye} size={14} />}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-text-3">证书</label>
        <textarea
          value={certificate}
          onChange={(event) => setCertificate(event.target.value)}
          rows={3}
          placeholder="可选，粘贴证书内容..."
          className="custom-scrollbar w-full resize-none rounded-lg border border-border/60 bg-bg-base px-3 py-2 font-mono text-[11px] text-text-1 placeholder:text-text-3 focus:border-primary/60 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-text-3">备注</label>
        <input
          value={remark}
          onChange={(event) => setRemark(event.target.value)}
          placeholder="可选备注..."
          className="w-full rounded-lg border border-border/60 bg-bg-base px-3 py-2 text-xs text-text-1 placeholder:text-text-3 focus:border-primary/60 focus:outline-none"
        />
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500">{error}</div>}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {saving && <AppIcon icon={icons.loader} size={13} className="animate-spin" />}
        {saving ? '保存中...' : '保存修改'}
      </button>
    </div>
  )
}
