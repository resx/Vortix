import { useState } from 'react'
import * as api from '../../../api/client'
import { AppIcon, icons } from '../../icons/AppIcon'
import { DEFAULT_BITS_BY_TYPE, ECDSA_BITS, KEY_TYPE_OPTIONS, MLDSA_BITS, RSA_BITS } from './constants'
import type { KeyType } from './types'

export function KeyPickerGenerateView({ onDone }: { onDone: () => void }) {
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
    if (!name.trim()) {
      setError('请输入密钥名称')
      return
    }
    setGenerating(true)
    setError('')
    setResultPub('')
    try {
      const data = await api.generateSshKey({
        name: name.trim(),
        type: keyType,
        ...(needBits && { bits }),
        ...(passphrase && { passphrase }),
        ...(comment && { comment }),
      })
      setResultPub(data.publicKey)
    } catch (error) {
      setError(error instanceof Error ? error.message : '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyPub = async () => {
    await navigator.clipboard.writeText(resultPub)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] text-text-3">密钥名称 *</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="例如: my-server-key"
          className="w-full rounded-lg border border-border/60 bg-bg-base px-3 py-2 text-xs text-text-1 placeholder:text-text-3 focus:border-primary/60 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-text-3">算法类型</label>
        <div className="grid grid-cols-4 gap-2">
          {KEY_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setKeyType(option.value)
                setBits(DEFAULT_BITS_BY_TYPE[option.value])
                setResultPub('')
                setError('')
              }}
              className={`rounded-lg border px-3 py-2 text-center text-xs transition-colors ${
                keyType === option.value
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-border/60 text-text-2 hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              <div className="font-medium">{option.label}</div>
              <div className="mt-0.5 text-[10px] text-text-3">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {needBits && (
        <div>
          <label className="mb-1.5 block text-[11px] text-text-3">
            {keyType === 'ecdsa' ? 'Curve Size' : keyType === 'rsa' ? 'Key Size' : 'Parameter Set'}
          </label>
          <div className="flex gap-2">
            {bitsOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setBits(value)}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  bits === value
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border/60 text-text-2 hover:border-primary/40'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-[11px] text-text-3">口令保护（可选）</label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="不给则不加密"
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
        <label className="mb-1.5 block text-[11px] text-text-3">注释（可选）</label>
        <input
          type="text"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="例如: user@hostname"
          className="w-full rounded-lg border border-border/60 bg-bg-base px-3 py-2 text-xs text-text-1 placeholder:text-text-3 focus:border-primary/60 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={generating}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {generating
          ? <AppIcon icon={icons.loader} size={13} className="animate-spin" />
          : <AppIcon icon={icons.key} size={13} />}
        {generating ? '生成中...' : '生成密钥'}
      </button>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500">{error}</div>}

      {resultPub && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-3">公钥（请加入目标服务器）</span>
            <button
              type="button"
              onClick={() => void handleCopyPub()}
              className="flex items-center gap-1 text-[11px] text-text-3 transition-colors hover:text-primary"
            >
              {copied
                ? <AppIcon icon={icons.check} size={11} className="text-green-500" />
                : <AppIcon icon={icons.copy} size={11} />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          <textarea
            readOnly
            value={resultPub}
            rows={3}
            className="custom-scrollbar w-full resize-none rounded-lg border border-border/60 bg-bg-subtle/50 px-3 py-2 font-mono text-[11px] text-text-2 focus:outline-none"
          />
          <button
            type="button"
            onClick={onDone}
            className="w-full rounded-lg bg-teal-500 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-600"
          >
            完成并返回
          </button>
        </div>
      )}
    </div>
  )
}
