import { useEffect, useRef, useState } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { AppIcon, icons } from '../icons/AppIcon'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { useUIStore } from '../../stores/useUIStore'
import { DEFAULT_PROFILE_ID } from '../../types/terminal-profile'
import TermThemePreview from './TermThemePreview'
import TermThemeGrid from './TermThemeGrid'
import * as api from '../../api/client'
import { handleTitleBarDoubleClick, handleTitleBarMouseDown } from '../../lib/window'
import { useT } from '../../i18n'

interface TermThemePanelProps {
  isOpen: boolean
  onClose: () => void
  windowMode?: boolean
}

function ModeTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
        active ? 'bg-primary text-white' : 'bg-bg-base text-text-2 hover:text-text-1'
      }`}
    >
      {label}
    </button>
  )
}

function ProfileSelector({
  profiles,
  activeId,
  onChange,
  placeholder,
}: {
  profiles: { id: string; name: string }[]
  activeId: string
  onChange: (id: string) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const current = profiles.find((profile) => profile.id === activeId)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="island-control inline-flex h-[30px] min-w-[120px] items-center gap-1.5 px-2.5 text-[12px] text-text-1"
      >
        <span className="truncate">{current?.name ?? placeholder}</span>
        <AppIcon icon={icons.chevronDown} size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[1] cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-[2] mt-1 min-w-[160px] rounded-lg border border-border/60 bg-bg-card p-1 shadow-lg">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  onChange(profile.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center rounded-md px-3 py-1.5 text-left text-[12px] transition-colors ${
                  profile.id === activeId
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-1 hover:bg-bg-base'
                }`}
              >
                {profile.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-text-3">{label}</span>
      <span className="truncate text-right text-text-1">{value}</span>
    </div>
  )
}

function ScoreCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-bg-card/30 px-3 py-2">
      <div className="text-[11px] text-text-3">{label}</div>
      <div className="mt-1 text-[18px] font-semibold text-text-1">{value}</div>
    </div>
  )
}

function getIssueMessage(
  t: (key: string, params?: Record<string, string | number>) => string,
  code: string,
): string {
  return t(`themeWorkbench.quality.issue.${code}`)
}

function ColorInputField({
  label,
  value,
  onChange,
}: {
  label: string
  value?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] text-text-3">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-bg-base px-2 py-2">
        <input
          type="color"
          value={(value && /^#[0-9a-fA-F]{6,8}$/.test(value)) ? value.slice(0, 7) : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-7 rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#RRGGBB"
          className="h-[28px] flex-1 bg-transparent text-[12px] text-text-1 outline-none placeholder:text-text-3"
        />
      </div>
    </label>
  )
}

export default function TermThemePanel({ isOpen, onClose, windowMode = false }: TermThemePanelProps) {
  const t = useT()
  const profileStore = useTerminalProfileStore()
  const themeStore = useThemeStore()
  const openConfirmDialog = useUIStore((state) => state.openConfirmDialog)
  const dragControls = useDragControls()
  const constraintRef = useRef<HTMLDivElement>(null)

  const [selectedProfileId, setSelectedProfileId] = useState(profileStore.activeProfileId)
  const [themeBusy, setThemeBusy] = useState(false)
  const [editingMode, setEditingMode] = useState<'light' | 'dark'>(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  useEffect(() => {
    if (!isOpen) return
    setSelectedProfileId(profileStore.activeProfileId)
  }, [isOpen, profileStore.activeProfileId])

  const allProfiles = profileStore.getAllProfiles()
  const profile = profileStore.getProfileById(selectedProfileId) ?? profileStore.getDefaultProfile()
  const fallbackTheme = themeStore.getThemeById(editingMode === 'dark' ? 'default-dark' : 'default-light')
    ?? themeStore.getThemesByMode(editingMode)[0]!

  const appliedThemeId = editingMode === 'dark' ? profile.colorSchemeDark : profile.colorSchemeLight
  const appliedTheme = themeStore.getThemeById(appliedThemeId) ?? fallbackTheme
  const previewCandidate = themeStore.previewThemeId ? themeStore.getThemeById(themeStore.previewThemeId) : undefined
  const previewTheme = previewCandidate?.mode === editingMode ? previewCandidate : appliedTheme
  const editingTheme = themeStore.draftTheme?.id === previewTheme.id ? themeStore.draftTheme : previewTheme
  const compareEnabled = themeStore.compareThemeId === appliedTheme.id
  const recentThemes = themeStore.recentThemeIds
    .map((themeId) => themeStore.getThemeById(themeId))
    .filter((theme): theme is typeof appliedTheme => theme != null)
    .filter((theme) => theme.mode === editingMode && theme.id !== previewTheme.id)
    .slice(0, 4)
  const analysis = themeStore.analyzeTheme(editingTheme, appliedTheme)
  const canManagePreviewTheme = editingTheme.source === 'custom'
  const isFavorite = themeStore.favorites.includes(previewTheme.id)

  useEffect(() => {
    if (!isOpen) return
    if (themeStore.previewThemeId !== previewTheme.id) {
      themeStore.setPreviewThemeId(previewTheme.id)
    }
    if (themeStore.compareThemeId && themeStore.compareThemeId !== appliedTheme.id) {
      themeStore.setCompareThemeId(undefined)
    }
  }, [appliedTheme.id, isOpen, previewTheme.id, themeStore])

  useEffect(() => {
    if (!isOpen) return
    if (themeStore.draftTheme?.id !== previewTheme.id) {
      themeStore.startDraftFromTheme(previewTheme.id)
    }
  }, [isOpen, previewTheme.id, themeStore])

  if (!isOpen) return null

  const applyPreviewTheme = () => {
    if (editingTheme.id === appliedTheme.id) return
    if (editingMode === 'dark') {
      profileStore.updateProfile(selectedProfileId, { colorSchemeDark: editingTheme.id })
    } else {
      profileStore.updateProfile(selectedProfileId, { colorSchemeLight: editingTheme.id })
    }
    themeStore.markThemeUsed(editingTheme.id)
    themeStore.setCompareThemeId(undefined)
  }

  const createThemeFromPreview = async () => {
    const name = window.prompt(t('themeWorkbench.prompt.themeName'), `${editingTheme.name} ${t('themeWorkbench.suffix.copy')}`)?.trim()
    if (!name) return
    setThemeBusy(true)
    try {
      const created = await themeStore.createTheme({
        name,
        mode: editingMode,
        author: editingTheme.author,
        terminal: { ...editingTheme.terminal },
        highlights: { ...editingTheme.highlights },
        ui: editingTheme.ui ? { ...editingTheme.ui } : undefined,
        meta: editingTheme.meta ? { ...editingTheme.meta } : undefined,
        behavior: editingTheme.behavior ? { ...editingTheme.behavior } : undefined,
        baseThemeId: editingTheme.id,
      })
      themeStore.setPreviewThemeId(created.id)
    } catch (error) {
      window.alert(t('themeWorkbench.toast.createFailed', { message: (error as Error).message }))
    } finally {
      setThemeBusy(false)
    }
  }

  const saveDraftTheme = async () => {
    if (!themeStore.draftTheme) return
    setThemeBusy(true)
    try {
      if (editingTheme.source === 'custom') {
        const updated = await themeStore.updateTheme(editingTheme.id, {
          terminal: editingTheme.terminal,
          highlights: editingTheme.highlights,
          ui: editingTheme.ui,
          meta: editingTheme.meta,
          behavior: editingTheme.behavior,
          baseThemeId: editingTheme.baseThemeId,
        })
        if (!updated) {
          window.alert(t('themeWorkbench.toast.saveFailed'))
          return
        }
        themeStore.startDraftFromTheme(updated.id)
        themeStore.setPreviewThemeId(updated.id)
      } else {
        await createThemeFromPreview()
      }
    } finally {
      setThemeBusy(false)
    }
  }

  const discardDraftTheme = () => {
    themeStore.startDraftFromTheme(previewTheme.id)
  }

  const handlePreviewSelect = (id: string) => {
    if (themeStore.dirty && themeStore.draftTheme?.id === previewTheme.id && id !== previewTheme.id) {
      openConfirmDialog({
        title: t('themeWorkbench.dialog.discard.title'),
        description: t('themeWorkbench.dialog.discard.desc'),
        confirmText: t('themeWorkbench.action.discard'),
        onConfirm: async () => {
          themeStore.startDraftFromTheme(id)
          themeStore.setPreviewThemeId(id)
        },
      })
      return
    }
    themeStore.startDraftFromTheme(id)
    themeStore.setPreviewThemeId(id)
  }

  const deletePreviewTheme = async () => {
    if (!canManagePreviewTheme) return
    const refs = allProfiles.filter((item) => {
      const refId = editingTheme.mode === 'dark' ? item.colorSchemeDark : item.colorSchemeLight
      return refId === editingTheme.id
    })
    if (refs.length > 0) {
      window.alert(t('themeWorkbench.toast.inUse', { count: refs.length }))
      return
    }

    openConfirmDialog({
      title: t('themeWorkbench.dialog.delete.title'),
      description: t('themeWorkbench.dialog.delete.desc', { name: editingTheme.name }),
      confirmText: t('themeWorkbench.action.delete'),
      danger: true,
      onConfirm: async () => {
        setThemeBusy(true)
        try {
          const ok = await themeStore.deleteTheme(editingTheme.id)
          if (!ok) {
            window.alert(t('themeWorkbench.toast.deleteFailed'))
            return
          }
          themeStore.setPreviewThemeId(appliedTheme.id)
        } finally {
          setThemeBusy(false)
        }
      },
    })
  }

  const importTheme = async () => {
    setThemeBusy(true)
    try {
      const picked = await api.pickFile(t('themeWorkbench.action.import'), 'JSON Files|*.json|All Files|*.*')
      if (!picked.content?.trim()) return
      const result = await themeStore.importThemes(picked.content)
      if (result.count > 0) {
        window.alert(t('themeWorkbench.toast.imported', { count: result.count }))
      } else {
        window.alert(result.errors.join('; ') || t('themeWorkbench.toast.importFailed'))
      }
    } finally {
      setThemeBusy(false)
    }
  }

  const exportTheme = async () => {
    if (!canManagePreviewTheme) return
    setThemeBusy(true)
    try {
      const response = await fetch(api.getThemeExportUrl(editingTheme.id), {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') || ''
      const match = /filename="?([^";]+)"?/i.exec(disposition)
      const fileName = match?.[1] || `${editingTheme.name}.vortix-theme.json`
      const saved = await api.saveDownloadToLocal(blob, fileName)
      window.alert(t('themeWorkbench.toast.exported', { path: saved }))
    } catch (error) {
      window.alert(t('themeWorkbench.toast.exportFailed', { message: (error as Error).message }))
    } finally {
      setThemeBusy(false)
    }
  }

  const createProfile = () => {
    const id = profileStore.createProfile({
      ...profile,
      name: t('themeWorkbench.profile.generated', { count: allProfiles.length }),
    })
    setSelectedProfileId(id)
    profileStore.setActiveProfileId(id)
  }

  const duplicateProfile = () => {
    const id = profileStore.duplicateProfile(selectedProfileId, `${profile.name} ${t('themeWorkbench.suffix.copy')}`)
    if (!id) return
    setSelectedProfileId(id)
    profileStore.setActiveProfileId(id)
  }

  const deleteProfile = () => {
    if (selectedProfileId === DEFAULT_PROFILE_ID) return
    profileStore.deleteProfile(selectedProfileId)
    setSelectedProfileId(DEFAULT_PROFILE_ID)
    profileStore.setActiveProfileId(DEFAULT_PROFILE_ID)
  }

  const content = (
    <>
      <div className="flex items-center gap-2 border-b border-border/50 bg-bg-card/35 px-5 py-3">
        <span className="text-[12px] text-text-3">{t('themeWorkbench.profile.label')}</span>
        <ProfileSelector
          profiles={allProfiles}
          activeId={selectedProfileId}
          placeholder={t('themeWorkbench.profile.label')}
          onChange={(id) => {
            setSelectedProfileId(id)
            profileStore.setActiveProfileId(id)
          }}
        />
        <button type="button" onClick={createProfile} className="island-btn h-[28px] rounded-md px-2 text-[11px] text-text-2">
          {t('themeWorkbench.profile.new')}
        </button>
        <button type="button" onClick={duplicateProfile} className="island-btn h-[28px] rounded-md px-2 text-[11px] text-text-2">
          {t('themeWorkbench.profile.duplicate')}
        </button>
        {selectedProfileId !== DEFAULT_PROFILE_ID && (
          <button
            type="button"
            onClick={deleteProfile}
            className="h-[28px] rounded-md border border-status-error/30 bg-status-error/5 px-2 text-[11px] text-status-error"
          >
            {t('themeWorkbench.profile.delete')}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="flex w-[320px] min-h-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <ModeTab label={t('themeWorkbench.mode.light')} active={editingMode === 'light'} onClick={() => setEditingMode('light')} />
            <ModeTab label={t('themeWorkbench.mode.dark')} active={editingMode === 'dark'} onClick={() => setEditingMode('dark')} />
          </div>
          <TermThemeGrid
            mode={editingMode}
            selectedId={appliedTheme.id}
            previewId={previewTheme.id}
            onPreview={handlePreviewSelect}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={applyPreviewTheme}
              disabled={themeBusy || editingTheme.id === appliedTheme.id}
              className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-1 disabled:opacity-50"
            >
              {t('themeWorkbench.action.applyToProfile')}
            </button>
            <button
              type="button"
              onClick={() => themeStore.setCompareThemeId(compareEnabled ? undefined : appliedTheme.id)}
              className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2"
            >
              {compareEnabled ? t('themeWorkbench.action.hideCompare') : t('themeWorkbench.action.compareWithCurrent')}
            </button>
            <button
              type="button"
              onClick={() => themeStore.setPreviewThemeId(appliedTheme.id)}
              className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2"
            >
              {t('themeWorkbench.action.resetPreview')}
            </button>
            <button
              type="button"
              onClick={() => themeStore.toggleFavorite(previewTheme.id)}
              className="island-btn inline-flex h-[30px] items-center gap-1.5 rounded-md px-3 text-[12px] text-text-2"
            >
              <AppIcon icon={isFavorite ? 'ph:star-fill' : 'ph:star'} size={13} />
              {isFavorite ? t('themeWorkbench.action.favorited') : t('themeWorkbench.action.favorite')}
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <TermThemePreview
              theme={editingTheme}
              compareTheme={compareEnabled ? appliedTheme : undefined}
              cursorStyle={profile.cursorStyle}
              cursorBlink={profile.cursorBlink}
              scenario={themeStore.activeScenario}
              onScenarioChange={themeStore.setActiveScenario}
            />
          </div>
        </div>

        <div className="flex w-[300px] min-h-0 flex-col gap-3 overflow-y-auto custom-scrollbar pr-1">
          <div className="rounded-2xl border border-border/60 bg-bg-card/25 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[16px] font-semibold text-text-1">{editingTheme.name}</div>
                <div className="mt-1 text-[12px] text-text-3">
                  {editingTheme.source === 'builtin' ? t('themeWorkbench.source.builtinTheme') : t('themeWorkbench.source.customTheme')}
                </div>
              </div>
              {editingTheme.id === appliedTheme.id && (
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary">
                  {t('themeWorkbench.state.active')}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <SummaryRow label={t('themeWorkbench.summary.mode')} value={editingTheme.mode === 'dark' ? t('themeWorkbench.mode.dark') : t('themeWorkbench.mode.light')} />
              <SummaryRow label={t('themeWorkbench.summary.profile')} value={profile.name} />
              <SummaryRow label={t('themeWorkbench.summary.applied')} value={appliedTheme.name} />
              <SummaryRow label={t('themeWorkbench.summary.preview')} value={editingTheme.name} />
              <SummaryRow label={t('themeWorkbench.summary.editing')} value={themeStore.dirty ? t('themeWorkbench.state.unsavedChanges') : t('themeWorkbench.state.inSync')} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={saveDraftTheme}
                disabled={themeBusy}
                className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2 disabled:opacity-50"
              >
                {editingTheme.source === 'custom' ? t('themeWorkbench.action.saveTheme') : t('themeWorkbench.action.saveCopy')}
              </button>
              <button
                type="button"
                onClick={discardDraftTheme}
                disabled={themeBusy || !themeStore.dirty}
                className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2 disabled:opacity-50"
              >
                {t('themeWorkbench.action.discard')}
              </button>
              <button
                type="button"
                onClick={importTheme}
                disabled={themeBusy}
                className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2 disabled:opacity-50"
              >
                {t('themeWorkbench.action.import')}
              </button>
              <button
                type="button"
                onClick={() => themeStore.repairDraftContrast()}
                disabled={themeBusy}
                className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2 disabled:opacity-50"
              >
                {t('themeWorkbench.action.autoRepair')}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-bg-card/25 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium text-text-1">{t('themeWorkbench.inspector.title')}</div>
                <div className="mt-1 text-[11px] text-text-3">{t('themeWorkbench.inspector.desc')}</div>
              </div>
              {themeStore.dirty && (
                <span className="rounded-full bg-status-warning/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-status-warning">
                  {t('themeWorkbench.state.dirty')}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <ColorInputField
                label={t('themeWorkbench.inspector.background')}
                value={editingTheme.terminal.background}
                onChange={(value) => themeStore.updateDraftTheme({ terminal: { background: value } })}
              />
              <ColorInputField
                label={t('themeWorkbench.inspector.foreground')}
                value={editingTheme.terminal.foreground}
                onChange={(value) => themeStore.updateDraftTheme({ terminal: { foreground: value } })}
              />
              <ColorInputField
                label={t('themeWorkbench.inspector.cursor')}
                value={editingTheme.terminal.cursor}
                onChange={(value) => themeStore.updateDraftTheme({ terminal: { cursor: value } })}
              />
              <ColorInputField
                label={t('themeWorkbench.inspector.selection')}
                value={editingTheme.terminal.selectionBackground}
                onChange={(value) => themeStore.updateDraftTheme({ terminal: { selectionBackground: value } })}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ColorInputField
                label={t('themeWorkbench.inspector.ansiRed')}
                value={editingTheme.terminal.red}
                onChange={(value) => themeStore.updateDraftTheme({ terminal: { red: value } })}
              />
              <ColorInputField
                label={t('themeWorkbench.inspector.ansiGreen')}
                value={editingTheme.terminal.green}
                onChange={(value) => themeStore.updateDraftTheme({ terminal: { green: value } })}
              />
              <ColorInputField
                label={t('themeWorkbench.inspector.ansiBlue')}
                value={editingTheme.terminal.blue}
                onChange={(value) => themeStore.updateDraftTheme({ terminal: { blue: value } })}
              />
              <ColorInputField
                label={t('themeWorkbench.inspector.ansiYellow')}
                value={editingTheme.terminal.yellow}
                onChange={(value) => themeStore.updateDraftTheme({ terminal: { yellow: value } })}
              />
              <ColorInputField
                label={t('themeWorkbench.inspector.highlightError')}
                value={editingTheme.highlights.error}
                onChange={(value) => themeStore.updateDraftTheme({ highlights: { error: value } })}
              />
              <ColorInputField
                label={t('themeWorkbench.inspector.highlightInfo')}
                value={editingTheme.highlights.info}
                onChange={(value) => themeStore.updateDraftTheme({ highlights: { info: value } })}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={exportTheme}
                disabled={themeBusy || !canManagePreviewTheme}
                className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2 disabled:opacity-50"
              >
                {t('themeWorkbench.action.export')}
              </button>
              <button
                type="button"
                onClick={deletePreviewTheme}
                disabled={themeBusy || !canManagePreviewTheme}
                className="h-[30px] rounded-md border border-status-error/30 bg-status-error/5 px-3 text-[12px] text-status-error disabled:opacity-50"
              >
                {t('themeWorkbench.action.delete')}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-bg-card/25 p-4">
            <div className="text-[13px] font-medium text-text-1">{t('themeWorkbench.quality.title')}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ScoreCard label={t('themeWorkbench.quality.score')} value={analysis.score} />
              <ScoreCard label={t('themeWorkbench.quality.contrast')} value={analysis.contrastScore} />
              <ScoreCard label={t('themeWorkbench.quality.distinct')} value={analysis.distinctivenessScore} />
              <ScoreCard label={t('themeWorkbench.quality.consistent')} value={analysis.consistencyScore} />
            </div>

            <div className="mt-4 space-y-2">
              {analysis.issues.length === 0 && (
                <div className="rounded-xl border border-border/60 bg-bg-base px-3 py-2 text-[12px] text-text-2">
                  {t('themeWorkbench.quality.noWarnings')}
                </div>
              )}
              {analysis.issues.map((issue) => (
                <div
                  key={`${issue.code}-${issue.field ?? 'global'}`}
                  className={`rounded-xl border px-3 py-2 text-[12px] ${
                    issue.level === 'error'
                      ? 'border-status-error/30 bg-status-error/5 text-status-error'
                      : issue.level === 'warning'
                        ? 'border-status-warning/30 bg-status-warning/5 text-status-warning'
                        : 'border-border/60 bg-bg-base text-text-2'
                  }`}
                >
                  {getIssueMessage(t, issue.code)}
                </div>
              ))}
            </div>

            {analysis.changedFields.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[12px] text-text-3">{t('themeWorkbench.quality.changedFields')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.changedFields.slice(0, 8).map((field) => (
                    <span
                      key={field}
                      className="rounded-full bg-bg-base px-2 py-1 text-[10px] text-text-2"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {recentThemes.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-bg-card/25 p-4">
              <div className="text-[13px] font-medium text-text-1">{t('themeWorkbench.recent.title')}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {recentThemes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => themeStore.setPreviewThemeId(theme.id)}
                    className="rounded-full bg-bg-base px-2.5 py-1 text-[11px] text-text-2 transition-colors hover:text-text-1"
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )

    if (windowMode) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[12px] island-surface">
        <div
          className="flex h-[46px] items-center justify-between border-b border-border/60 bg-bg-card/45 px-5"
          onMouseDown={handleTitleBarMouseDown}
          onDoubleClick={handleTitleBarDoubleClick}
        >
          <span className="text-[14px] font-medium text-text-1">{t('themeWorkbench.title')}</span>
          <button
            type="button"
            onClick={onClose}
            className="island-btn flex h-[28px] w-[28px] items-center justify-center rounded-md text-text-3 transition-colors hover:text-text-1"
          >
            <AppIcon icon={icons.close} size={14} />
          </button>
        </div>
        {content}
      </div>
    )
  }

  return (
    <motion.div
      ref={constraintRef}
      className="fixed inset-0 z-[310] flex items-center justify-center p-4 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={constraintRef}
        dragElastic={0}
        dragMomentum={false}
        initial={{ scale: 0.96 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="pointer-events-auto flex h-[760px] max-h-[95vh] w-[1380px] max-w-[96vw] flex-col overflow-hidden rounded-2xl island-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex h-[46px] items-center justify-between border-b border-border/60 bg-bg-card/45 px-5 select-none"
          onPointerDown={(event) => {
            if (!(event.target as HTMLElement).closest('button')) {
              dragControls.start(event)
            }
          }}
        >
          <span className="text-[14px] font-medium text-text-1">{t('themeWorkbench.title')}</span>
          <button
            type="button"
            onClick={onClose}
            className="island-btn flex h-[28px] w-[28px] items-center justify-center rounded-md text-text-3 transition-colors hover:text-text-1"
          >
            <AppIcon icon={icons.close} size={14} />
          </button>
        </div>
        {content}
      </motion.div>
    </motion.div>
  )
}
