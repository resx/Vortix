import { useEffect, useRef, useState } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { useT } from '../../i18n'
import type { HostKeyDialogDecision, HostKeyDialogHostRole } from '../../stores/useUIStore'

export interface ConnectionLoadingStep {
  id: string
  label: string
  status: 'active' | 'done' | 'error'
}

export interface ConnectionLoadingHostKeyPrompt {
  reason: 'unknown' | 'mismatch'
  host: string
  port: number
  username: string
  keyType: string
  fingerprintSha256: string
  connectionName?: string | null
  knownFingerprintSha256?: string | null
  hostRole?: HostKeyDialogHostRole | null
  hopIndex?: number | null
  hopCount?: number | null
}

interface ConnectionLoadingViewProps {
  title: string
  subtitle?: string
  steps: ConnectionLoadingStep[]
  error?: string | null
  hostKeyPrompt?: ConnectionLoadingHostKeyPrompt | null
  onHostKeyDecision: (decision: HostKeyDialogDecision) => void
  onRetry?: (() => void) | null
}

function StepIndicator({ status }: { status: ConnectionLoadingStep['status'] }) {
  if (status === 'done') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-success/12 text-status-success">
        <AppIcon icon={icons.check} size={13} />
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-error/12 text-status-error">
        <AppIcon icon={icons.alertTriangle} size={13} />
      </span>
    )
  }

  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/12 text-primary">
      <AppIcon icon={icons.loader} size={13} className="animate-spin" />
    </span>
  )
}

export default function ConnectionLoadingView({
  title,
  subtitle,
  steps,
  error,
  hostKeyPrompt,
  onHostKeyDecision,
  onRetry,
}: ConnectionLoadingViewProps) {
  const t = useT()
  const rootRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  const [ultraCompact, setUltraCompact] = useState(false)
  const isMismatch = hostKeyPrompt?.reason === 'mismatch'
  const roleLabel = hostKeyPrompt?.hostRole ? t(`hostkey.dialog.role.${hostKeyPrompt.hostRole}`) : null
  const hopLabel =
    hostKeyPrompt?.hopCount && hostKeyPrompt.hopCount > 1 && hostKeyPrompt.hopIndex
      ? `${hostKeyPrompt.hopIndex}/${hostKeyPrompt.hopCount}`
      : null
  const connectionLabel =
    hostKeyPrompt?.connectionName?.trim() || (hostKeyPrompt ? `${hostKeyPrompt.username}@${hostKeyPrompt.host}` : '')

  useEffect(() => {
    const node = rootRef.current
    if (!node || typeof ResizeObserver === 'undefined') return

    const syncLayoutMode = () => {
      const { width, height } = node.getBoundingClientRect()
      setCompact(width < 560 || height < 460)
      setUltraCompact(width < 400 || height < 320)
    }

    syncLayoutMode()
    const observer = new ResizeObserver(() => syncLayoutMode())
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const shellPadding = ultraCompact ? 'px-3 py-3' : compact ? 'px-4 py-4' : 'px-6 py-6 md:px-8 md:py-7'
  const shellGap = ultraCompact ? 'gap-3' : compact ? 'gap-4' : 'gap-6'
  const cardRadius = ultraCompact ? 'rounded-2xl' : 'rounded-3xl'
  const iconSize = ultraCompact ? 18 : compact ? 20 : 24
  const iconBox = ultraCompact ? 'h-9 w-9 rounded-xl' : compact ? 'h-10 w-10 rounded-2xl' : 'h-12 w-12 rounded-2xl'
  const titleSize = ultraCompact ? 'text-[16px]' : compact ? 'text-[18px]' : 'text-[24px]'
  const subtitleSize = ultraCompact ? 'text-[11px]' : 'text-[13px]'
  const sectionLabelSize = ultraCompact ? 'text-[10px]' : 'text-[11px]'
  const stepTextSize = ultraCompact ? 'text-[12px] leading-5' : 'text-[13px] leading-6'
  const detailGridClass = ultraCompact ? 'grid-cols-1' : compact ? 'grid-cols-[92px_1fr]' : 'grid-cols-[110px_1fr]'
  const detailTextClass = ultraCompact ? 'text-[11px]' : 'text-[12px]'
  const actionButtonClass = ultraCompact ? 'px-3 py-1.5 text-[11px]' : 'px-3.5 py-2 text-[12px]'

  return (
    <div ref={rootRef} className="connection-loading-scrollbar absolute inset-0 z-20 overflow-auto bg-[radial-gradient(circle_at_top,rgba(64,128,255,0.14),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.05))] backdrop-blur-sm">
      <div className={`flex min-h-full ${ultraCompact ? 'items-stretch justify-stretch p-2' : compact ? 'items-center justify-center p-3' : 'items-center justify-center px-6 py-8'}`}>
        <div className={`glass-context relative w-full ${ultraCompact ? 'max-w-none' : compact ? 'max-w-xl' : 'max-w-3xl'} overflow-hidden ${cardRadius} border border-border-subtle bg-bg-card/88 shadow-[0_24px_80px_rgba(0,0,0,0.18)]`}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          <div className={`flex flex-col ${shellGap} ${shellPadding}`}>
            <div className={`flex ${ultraCompact ? 'items-center gap-3' : 'items-start gap-4'}`}>
              <div className={`flex shrink-0 items-center justify-center ${iconBox} ${
                error ? 'bg-status-error/10 text-status-error' : 'bg-primary/10 text-primary'
              }`}>
                <AppIcon icon={error ? icons.alertTriangle : icons.loader} size={iconSize} className={!error ? 'animate-spin' : undefined} />
              </div>

              <div className="min-w-0 flex-1">
                <div className={`${sectionLabelSize} font-semibold uppercase tracking-[0.18em] text-text-3`}>
                  {t('connectionLoading.session')}
                </div>
                <div className={`mt-1 font-semibold leading-tight text-text-1 ${titleSize}`}>
                  {error ? t('connectionLoading.failedTitle') : title}
                </div>
                {subtitle && (
                  <div className={`mt-2 break-all leading-relaxed text-text-2 ${subtitleSize}`}>
                    {subtitle}
                  </div>
                )}
              </div>
            </div>

            {steps.length > 0 && (
              <div className={`${ultraCompact ? 'rounded-xl px-3 py-3' : 'rounded-2xl px-4 py-4'} border border-border-subtle bg-bg-subtle/55`}>
                <div className={`${sectionLabelSize} font-semibold uppercase tracking-[0.16em] text-text-3`}>
                  {t('connectionLoading.flow')}
                </div>
                <div className={`${ultraCompact ? 'mt-3 gap-2' : 'mt-4 gap-3'} flex flex-col`}>
                  {steps.map((step, index) => (
                    <div key={step.id} className={`flex items-start ${ultraCompact ? 'gap-2.5' : 'gap-3'}`}>
                      <div className="relative flex shrink-0 flex-col items-center">
                        <StepIndicator status={step.status} />
                        {index < steps.length - 1 && (
                          <div className={`${ultraCompact ? 'h-5' : 'h-7'} mt-1 w-px bg-border-subtle`} />
                        )}
                      </div>
                      <div className={`min-w-0 pt-0.5 text-text-1 ${stepTextSize}`}>
                        {step.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hostKeyPrompt && (
              <div className={`${ultraCompact ? 'rounded-xl px-3 py-3' : 'rounded-2xl px-4 py-4'} border ${
                isMismatch ? 'border-status-error/20 bg-status-error/5' : 'border-primary/20 bg-primary/5'
              }`}>
                <div className={`flex ${ultraCompact ? 'flex-col gap-3' : 'items-start gap-3'}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    isMismatch ? 'bg-status-error/10 text-status-error' : 'bg-primary/10 text-primary'
                  }`}>
                    <AppIcon icon={isMismatch ? icons.alertTriangle : icons.lock} size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={`${ultraCompact ? 'text-[13px]' : 'text-[14px]'} font-medium text-text-1`}>
                        {t(isMismatch ? 'hostkey.dialog.title.mismatch' : 'hostkey.dialog.title.unknown')}
                      </div>
                      {roleLabel && (
                        <span className="rounded-full bg-bg-card/70 px-2 py-0.5 text-[10px] font-medium text-text-2">
                          {roleLabel}
                        </span>
                      )}
                      {hopLabel && (
                        <span className="rounded-full bg-bg-card/70 px-2 py-0.5 text-[10px] font-medium text-text-2">
                          {hopLabel}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-[12px] leading-relaxed text-text-2">
                      {t(isMismatch ? 'hostkey.dialog.description.mismatch' : 'hostkey.dialog.description.unknown')}
                    </div>

                    <div className={`mt-4 grid ${detailGridClass} gap-x-3 gap-y-2 ${detailTextClass}`}>
                      <div className="text-text-3">{t('hostkey.dialog.field.connection')}</div>
                      <div className="break-all text-text-1">{connectionLabel}</div>
                      {roleLabel && (
                        <>
                          <div className="text-text-3">{t('hostkey.dialog.field.role')}</div>
                          <div className="text-text-1">{roleLabel}</div>
                        </>
                      )}
                      <div className="text-text-3">{t('hostkey.dialog.field.host')}</div>
                      <div className="break-all text-text-1">{hostKeyPrompt.host}</div>
                      <div className="text-text-3">{t('hostkey.dialog.field.port')}</div>
                      <div className="text-text-1">{hostKeyPrompt.port}</div>
                      <div className="text-text-3">{t('hostkey.dialog.field.username')}</div>
                      <div className="break-all text-text-1">{hostKeyPrompt.username}</div>
                      <div className="text-text-3">{t('hostkey.dialog.field.algorithm')}</div>
                      <div className="break-all font-mono text-text-1">{hostKeyPrompt.keyType}</div>
                      <div className="text-text-3">{t('hostkey.dialog.field.sha256')}</div>
                      <div className="break-all font-mono text-text-1">{hostKeyPrompt.fingerprintSha256}</div>
                      {isMismatch && hostKeyPrompt.knownFingerprintSha256 && (
                        <>
                          <div className="text-text-3">{t('hostkey.dialog.field.storedSha256')}</div>
                          <div className="break-all font-mono text-status-error">{hostKeyPrompt.knownFingerprintSha256}</div>
                        </>
                      )}
                    </div>

                    <div className={`mt-4 flex flex-wrap items-center ${ultraCompact ? 'justify-stretch gap-2' : 'justify-end gap-2'}`}>
                      <button
                        onClick={() => onHostKeyDecision('reject')}
                        className={`rounded-xl bg-bg-card font-medium text-text-2 transition-colors hover:bg-bg-hover ${actionButtonClass} ${ultraCompact ? 'flex-1' : ''}`}
                      >
                        {t('hostkey.dialog.cancel')}
                      </button>
                      <button
                        onClick={() => onHostKeyDecision(isMismatch ? 'replace' : 'trust')}
                        className={`rounded-xl font-medium transition-colors ${actionButtonClass} ${ultraCompact ? 'flex-1' : ''} ${
                          isMismatch
                            ? 'bg-status-error/12 text-status-error hover:bg-status-error/18'
                            : 'bg-primary text-white hover:opacity-90'
                        }`}
                      >
                        {t(isMismatch ? 'hostkey.dialog.replace' : 'hostkey.dialog.trust')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className={`${ultraCompact ? 'rounded-xl px-3 py-3' : 'rounded-2xl px-4 py-4'} border border-status-error/20 bg-status-error/6`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-status-error">
                    <AppIcon icon={icons.alertTriangle} size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className={`${ultraCompact ? 'text-[12px]' : 'text-[13px]'} font-medium text-status-error`}>{t('connectionLoading.errorTitle')}</div>
                    <div className={`mt-1 break-all leading-relaxed text-text-2 ${detailTextClass}`}>{error}</div>
                    {onRetry && !hostKeyPrompt && (
                      <div className={`mt-4 flex ${ultraCompact ? 'justify-stretch' : 'justify-end'}`}>
                        <button
                          onClick={onRetry}
                          className={`rounded-xl bg-primary font-medium text-white transition-opacity hover:opacity-90 ${actionButtonClass} ${ultraCompact ? 'flex-1' : ''}`}
                        >
                          {t('common.retry')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
