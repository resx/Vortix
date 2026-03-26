import { cn } from '../../lib/utils'
import type { ThemePreviewScenario, VortixTheme } from '../../types/theme'
import { useT } from '../../i18n'

const SCENARIOS: ThemePreviewScenario[] = ['shell', 'logs', 'git-diff', 'trace', 'ssh', 'unfocused']

function parseHexColor(hex?: string): [number, number, number] | null {
  if (!hex) return null
  const cleaned = hex.trim().replace('#', '')
  const base = cleaned.length >= 6 ? cleaned.slice(0, 6) : ''
  if (!/^[0-9a-fA-F]{6}$/.test(base)) return null
  return [
    Number.parseInt(base.slice(0, 2), 16),
    Number.parseInt(base.slice(2, 4), 16),
    Number.parseInt(base.slice(4, 6), 16),
  ]
}

function luminance(hex?: string): number | null {
  const rgb = parseHexColor(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(fg?: string, bg?: string): number | null {
  const fgLum = luminance(fg)
  const bgLum = luminance(bg)
  if (fgLum == null || bgLum == null) return null
  const lighter = Math.max(fgLum, bgLum)
  const darker = Math.min(fgLum, bgLum)
  return (lighter + 0.05) / (darker + 0.05)
}

function fallbackContrastColor(bg: string): string {
  const bgLum = luminance(bg) ?? 0
  return bgLum < 0.5 ? '#F8FAFC' : '#111827'
}

function ensureContrast(color: string | undefined, bg: string, minRatio = 4.5): string {
  const ratio = contrastRatio(color, bg)
  if (ratio != null && ratio >= minRatio) return color!
  return fallbackContrastColor(bg)
}

function PreviewTerminal({
  theme,
  label,
  cursorStyle,
  cursorBlink,
  scenario,
  dimmed = false,
  t,
}: {
  theme: VortixTheme
  label: string
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scenario: ThemePreviewScenario
  dimmed?: boolean
  t: (key: string) => string
}) {
  const terminal = theme.terminal
  const highlights = theme.highlights
  const bg = terminal.background ?? '#1E1E1E'
  const fg = ensureContrast(terminal.foreground ?? '#D4D4D4', bg, 4.5)
  const cursorColor = ensureContrast(terminal.cursor ?? fg, bg, 3)
  const selectionColor = terminal.selectionBackground ?? `${fg}33`
  const selectionText = ensureContrast(terminal.selectionForeground ?? fg, selectionColor, 4.5)
  const headerLabelColor = ensureContrast(terminal.brightBlack ?? terminal.foreground ?? fg, bg, 4.5)
  const headerThemeNameColor = ensureContrast(terminal.foreground ?? fg, bg, 4.5)
  const textDim = dimmed ? 'opacity-65' : ''
  const cursorClass = cursorBlink ? 'animate-[terminalBlink_1s_step-end_infinite]' : ''

  const green = ensureContrast(terminal.green, bg, 3)
  const blue = ensureContrast(terminal.blue, bg, 3)
  const cyan = ensureContrast(terminal.cyan, bg, 3)
  const yellow = ensureContrast(terminal.yellow, bg, 3)
  const red = ensureContrast(terminal.red, bg, 3)
  const info = ensureContrast(highlights.info, bg, 3)
  const warning = ensureContrast(highlights.warning, bg, 3)
  const error = ensureContrast(highlights.error, bg, 3)
  const debug = ensureContrast(highlights.debug, bg, 3)
  const path = ensureContrast(highlights.path, bg, 3)
  const url = ensureContrast(highlights.url, bg, 3)
  const timestamp = ensureContrast(highlights.timestamp, bg, 3)
  const env = ensureContrast(highlights.env, bg, 3)
  const ipMac = ensureContrast(highlights.ipMac, bg, 3)
  const riskStrip = ensureContrast(terminal.red ?? highlights.error, bg, 3)
  const badgeBg = ensureContrast(terminal.blue ?? highlights.info, bg, 3)

  const cursor = (
    <span
      className={cn('inline-block align-middle', cursorClass)}
      style={{
        backgroundColor: cursorStyle === 'block' ? cursorColor : undefined,
        borderBottom: cursorStyle === 'underline' ? `2px solid ${cursorColor}` : undefined,
        borderLeft: cursorStyle === 'bar' ? `2px solid ${cursorColor}` : undefined,
        width: cursorStyle === 'block' ? 8 : cursorStyle === 'underline' ? 8 : 2,
        height: cursorStyle === 'underline' ? 2 : 14,
      }}
    />
  )

  const shellPreview = (
    <>
      <div className={textDim}>
        <span style={{ color: green }}>dev@vortix</span>
        <span>:</span>
        <span style={{ color: blue }}>~/workspace</span>
        <span>$ </span>
        <span>ls -la</span>
      </div>
      <div className={textDim}>
        <span style={{ color: blue }}>drwxr-xr-x</span>
        <span> 8 root root 4096 </span>
        <span style={{ color: cyan }}>src/</span>
      </div>
      <div className={textDim}>
        <span style={{ color: green }}>-rwxr-xr-x</span>
        <span> 1 root root 1420 </span>
        <span style={{ color: green }}>deploy.sh</span>
      </div>
      <div className={textDim}>
        <span>cat </span>
        <span className="rounded-sm px-1" style={{ backgroundColor: selectionColor, color: selectionText }}>
          .env.production
        </span>
      </div>
      <div className={textDim}>
        <span style={{ color: green }}>dev@vortix</span>
        <span>:</span>
        <span style={{ color: blue }}>~/workspace</span>
        <span>$ </span>
        {cursor}
      </div>
    </>
  )

  const logsPreview = (
    <>
      <div className={textDim}>
        <span style={{ color: timestamp }}>[12:09:11]</span>
        <span> </span>
        <span style={{ color: info }}>INFO</span>
        <span> API gateway ready on </span>
        <span style={{ color: url }}>https://127.0.0.1:3002</span>
      </div>
      <div className={textDim}>
        <span style={{ color: timestamp }}>[12:09:14]</span>
        <span> </span>
        <span style={{ color: warning }}>WARN</span>
        <span> latency above budget for </span>
        <span style={{ color: path }}>/srv/app/logs</span>
      </div>
      <div className={textDim}>
        <span style={{ color: timestamp }}>[12:09:15]</span>
        <span> </span>
        <span style={{ color: error }}>ERROR</span>
        <span> ssh auth rejected for </span>
        <span style={{ color: env }}>prod-eu-1</span>
      </div>
      <div className={textDim}>
        <span style={{ color: debug }}>DEBUG</span>
        <span> retry=2 host=10.10.20.5 agent=ssh_worker</span>
      </div>
    </>
  )

  const diffPreview = (
    <>
      <div className={textDim}>
        <span style={{ color: yellow }}>diff --git</span>
        <span> a/src/server.ts b/src/server.ts</span>
      </div>
      <div className={textDim}>
        <span style={{ color: red }}>- const timeout = 5000</span>
      </div>
      <div className={textDim}>
        <span style={{ color: green }}>+ const timeout = 8000</span>
      </div>
      <div className={textDim}>
        <span style={{ color: cyan }}>@@ -18,7 +18,7 @@</span>
      </div>
      <div className={textDim}>
        <span>  </span>
        <span style={{ color: fg }}>server.listen(port)</span>
      </div>
    </>
  )

  const tracePreview = (
    <>
      <div className={textDim}>
        <span style={{ color: error }}>TypeError</span>
        <span>: Cannot read properties of undefined</span>
      </div>
      <div className={textDim}>
        <span>  at </span>
        <span style={{ color: path }}>src/components/settings/TermThemePanel.tsx:188</span>
      </div>
      <div className={textDim}>
        <span>  at </span>
        <span style={{ color: path }}>src/stores/useThemeStore.ts:276</span>
      </div>
      <div className={textDim}>
        <span style={{ color: debug }}>hint</span>
        <span>: verify previewThemeId before applyProfileTheme()</span>
      </div>
    </>
  )

  const sshPreview = (
    <>
      <div className="mb-2 flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
          style={{ backgroundColor: badgeBg }}
        >
          {t('themeWorkbench.preview.prodSsh')}
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: fg }}>
          root@db-shard-01
        </span>
      </div>
      <div className="mb-3 h-[4px] rounded-full" style={{ backgroundColor: riskStrip }} />
      <div className={textDim}>
        <span style={{ color: green }}>root@db-shard-01</span>
        <span>:</span>
        <span style={{ color: blue }}>/var/log/app</span>
        <span># tail -f access.log</span>
      </div>
      <div className={textDim}>
        <span style={{ color: warning }}>rate-limit</span>
        <span> spike detected from </span>
        <span style={{ color: ipMac }}>172.21.8.12</span>
      </div>
      <div className={textDim}>
        <span style={{ color: error }}>prod</span>
        <span> session has write access</span>
      </div>
    </>
  )

  const unfocusedPreview = (
    <>
      <div className={cn('mb-2 flex items-center gap-2', textDim)}>
        <span className="rounded-full bg-bg-base px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-text-3">
          {t('themeWorkbench.preview.inactive')}
        </span>
        <span className="text-[11px]" style={{ color: fg }}>
          {t('themeWorkbench.preview.unfocusedHint')}
        </span>
      </div>
      <div className={textDim}>
        <span style={{ color: green }}>ops@maintenance</span>
        <span>:</span>
        <span style={{ color: blue }}>~/logs</span>
        <span>$ grep ERROR app.log</span>
      </div>
      <div className={textDim}>
        <span className="rounded-sm px-1" style={{ backgroundColor: terminal.selectionInactiveBackground ?? `${fg}22`, color: fg }}>
          {t('themeWorkbench.preview.inactiveSelection')}
        </span>
      </div>
      <div className={textDim}>
        <span>{t('themeWorkbench.preview.cursorLabel')}</span>
        <span className="ml-2 inline-flex opacity-60">{cursor}</span>
      </div>
    </>
  )

  const content = {
    shell: shellPreview,
    logs: logsPreview,
    'git-diff': diffPreview,
    trace: tracePreview,
    ssh: sshPreview,
    unfocused: unfocusedPreview,
  }[scenario]

  return (
    <div
      className="flex h-full min-h-[300px] flex-col overflow-hidden rounded-2xl border border-border/60"
      style={{ backgroundColor: bg, color: fg }}
    >
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2 text-[11px] uppercase tracking-[0.12em]">
        <span style={{ color: headerLabelColor }}>{label}</span>
        <span style={{ color: headerThemeNameColor }}>{theme.name}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden px-4 py-4 font-mono text-[12px] leading-[1.7]">
        {content}
      </div>
    </div>
  )
}

export default function TermThemePreview({
  theme,
  compareTheme,
  cursorStyle,
  cursorBlink,
  scenario,
  onScenarioChange,
}: {
  theme: VortixTheme
  compareTheme?: VortixTheme
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scenario: ThemePreviewScenario
  onScenarioChange: (scenario: ThemePreviewScenario) => void
}) {
  const t = useT()
  const activeScenario = SCENARIOS.find((item) => item === scenario) ?? SCENARIOS[0]

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border/60 bg-bg-card/25 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-text-1">{t('themeWorkbench.preview.title')}</div>
          <div className="mt-1 text-[12px] text-text-3">{t(`themeWorkbench.preview.scenario.${activeScenario}.description`)}</div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {SCENARIOS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onScenarioChange(item)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] transition-colors',
                item === scenario
                  ? 'bg-primary text-white'
                  : 'bg-bg-base text-text-2 hover:text-text-1',
              )}
            >
              {t(`themeWorkbench.preview.scenario.${item}.label`)}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('mt-4 grid flex-1 min-h-0 gap-4', compareTheme ? 'grid-cols-2' : 'grid-cols-1')}>
        <PreviewTerminal
          theme={theme}
          label={compareTheme ? t('themeWorkbench.preview.candidate') : t('themeWorkbench.preview.preview')}
          cursorStyle={cursorStyle}
          cursorBlink={cursorBlink}
          scenario={scenario}
          dimmed={scenario === 'unfocused'}
          t={t}
        />
        {compareTheme && (
          <PreviewTerminal
            theme={compareTheme}
            label={t('themeWorkbench.preview.current')}
            cursorStyle={cursorStyle}
            cursorBlink={cursorBlink}
            scenario={scenario}
            dimmed={scenario === 'unfocused'}
            t={t}
          />
        )}
      </div>
    </div>
  )
}
