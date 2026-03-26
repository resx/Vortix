import { cn } from '../../../lib/utils'
import type { ThemePreviewScenario, VortixTheme } from '../../../types/theme'
import { ensureContrast } from './preview-color-utils'

export const SCENARIOS: ThemePreviewScenario[] = ['shell', 'logs', 'git-diff', 'trace', 'ssh', 'unfocused']

interface PreviewScenarioPalette {
  bg: string
  fg: string
  selectionColor: string
  selectionText: string
  green: string
  blue: string
  cyan: string
  yellow: string
  red: string
  info: string
  warning: string
  error: string
  debug: string
  path: string
  url: string
  timestamp: string
  env: string
  ipMac: string
  riskStrip: string
  badgeBg: string
}

export function buildPreviewPalette(theme: VortixTheme): PreviewScenarioPalette {
  const terminal = theme.terminal
  const highlights = theme.highlights
  const bg = terminal.background ?? '#1E1E1E'
  const fg = ensureContrast(terminal.foreground ?? '#D4D4D4', bg, 4.5)
  const selectionColor = terminal.selectionBackground ?? `${fg}33`

  return {
    bg,
    fg,
    selectionColor,
    selectionText: ensureContrast(terminal.selectionForeground ?? fg, selectionColor, 4.5),
    green: ensureContrast(terminal.green, bg, 3),
    blue: ensureContrast(terminal.blue, bg, 3),
    cyan: ensureContrast(terminal.cyan, bg, 3),
    yellow: ensureContrast(terminal.yellow, bg, 3),
    red: ensureContrast(terminal.red, bg, 3),
    info: ensureContrast(highlights.info, bg, 3),
    warning: ensureContrast(highlights.warning, bg, 3),
    error: ensureContrast(highlights.error, bg, 3),
    debug: ensureContrast(highlights.debug, bg, 3),
    path: ensureContrast(highlights.path, bg, 3),
    url: ensureContrast(highlights.url, bg, 3),
    timestamp: ensureContrast(highlights.timestamp, bg, 3),
    env: ensureContrast(highlights.env, bg, 3),
    ipMac: ensureContrast(highlights.ipMac, bg, 3),
    riskStrip: ensureContrast(terminal.red ?? highlights.error, bg, 3),
    badgeBg: ensureContrast(terminal.blue ?? highlights.info, bg, 3),
  }
}

export function renderPreviewScenario({
  scenario,
  palette,
  textDim,
  cursor,
  terminal,
  t,
}: {
  scenario: ThemePreviewScenario
  palette: PreviewScenarioPalette
  textDim: string
  cursor: React.ReactNode
  terminal: VortixTheme['terminal']
  t: (key: string) => string
}) {
  const { fg } = palette

  const shellPreview = (
    <>
      <div className={textDim}>
        <span style={{ color: palette.green }}>dev@vortix</span>
        <span>:</span>
        <span style={{ color: palette.blue }}>~/workspace</span>
        <span>$ </span>
        <span>ls -la</span>
      </div>
      <div className={textDim}>
        <span style={{ color: palette.blue }}>drwxr-xr-x</span>
        <span> 8 root root 4096 </span>
        <span style={{ color: palette.cyan }}>src/</span>
      </div>
      <div className={textDim}>
        <span style={{ color: palette.green }}>-rwxr-xr-x</span>
        <span> 1 root root 1420 </span>
        <span style={{ color: palette.green }}>deploy.sh</span>
      </div>
      <div className={textDim}>
        <span>cat </span>
        <span className="rounded-sm px-1" style={{ backgroundColor: palette.selectionColor, color: palette.selectionText }}>
          .env.production
        </span>
      </div>
      <div className={textDim}>
        <span style={{ color: palette.green }}>dev@vortix</span>
        <span>:</span>
        <span style={{ color: palette.blue }}>~/workspace</span>
        <span>$ </span>
        {cursor}
      </div>
    </>
  )

  const logsPreview = (
    <>
      <div className={textDim}>
        <span style={{ color: palette.timestamp }}>[12:09:11]</span>
        <span> </span>
        <span style={{ color: palette.info }}>INFO</span>
        <span> API gateway ready on </span>
        <span style={{ color: palette.url }}>https://127.0.0.1:3002</span>
      </div>
      <div className={textDim}>
        <span style={{ color: palette.timestamp }}>[12:09:14]</span>
        <span> </span>
        <span style={{ color: palette.warning }}>WARN</span>
        <span> latency above budget for </span>
        <span style={{ color: palette.path }}>/srv/app/logs</span>
      </div>
      <div className={textDim}>
        <span style={{ color: palette.timestamp }}>[12:09:15]</span>
        <span> </span>
        <span style={{ color: palette.error }}>ERROR</span>
        <span> ssh auth rejected for </span>
        <span style={{ color: palette.env }}>prod-eu-1</span>
      </div>
      <div className={textDim}>
        <span style={{ color: palette.debug }}>DEBUG</span>
        <span> retry=2 host=10.10.20.5 agent=ssh_worker</span>
      </div>
    </>
  )

  const diffPreview = (
    <>
      <div className={textDim}>
        <span style={{ color: palette.yellow }}>diff --git</span>
        <span> a/src/server.ts b/src/server.ts</span>
      </div>
      <div className={textDim}>
        <span style={{ color: palette.red }}>- const timeout = 5000</span>
      </div>
      <div className={textDim}>
        <span style={{ color: palette.green }}>+ const timeout = 8000</span>
      </div>
      <div className={textDim}>
        <span style={{ color: palette.cyan }}>@@ -18,7 +18,7 @@</span>
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
        <span style={{ color: palette.error }}>TypeError</span>
        <span>: Cannot read properties of undefined</span>
      </div>
      <div className={textDim}>
        <span>  at </span>
        <span style={{ color: palette.path }}>src/components/settings/TermThemePanel.tsx:188</span>
      </div>
      <div className={textDim}>
        <span>  at </span>
        <span style={{ color: palette.path }}>src/stores/useThemeStore.ts:276</span>
      </div>
      <div className={textDim}>
        <span style={{ color: palette.debug }}>hint</span>
        <span>: verify previewThemeId before applyProfileTheme()</span>
      </div>
    </>
  )

  const sshPreview = (
    <>
      <div className="mb-2 flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
          style={{ backgroundColor: palette.badgeBg }}
        >
          {t('themeWorkbench.preview.prodSsh')}
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: fg }}>
          root@db-shard-01
        </span>
      </div>
      <div className="mb-3 h-[4px] rounded-full" style={{ backgroundColor: palette.riskStrip }} />
      <div className={textDim}>
        <span style={{ color: palette.green }}>root@db-shard-01</span>
        <span>:</span>
        <span style={{ color: palette.blue }}>/var/log/app</span>
        <span># tail -f access.log</span>
      </div>
      <div className={textDim}>
        <span style={{ color: palette.warning }}>rate-limit</span>
        <span> spike detected from </span>
        <span style={{ color: palette.ipMac }}>172.21.8.12</span>
      </div>
      <div className={textDim}>
        <span style={{ color: palette.error }}>prod</span>
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
        <span style={{ color: palette.green }}>ops@maintenance</span>
        <span>:</span>
        <span style={{ color: palette.blue }}>~/logs</span>
        <span>$ grep ERROR app.log</span>
      </div>
      <div className={textDim}>
        <span
          className="rounded-sm px-1"
          style={{ backgroundColor: terminal.selectionInactiveBackground ?? `${fg}22`, color: fg }}
        >
          {t('themeWorkbench.preview.inactiveSelection')}
        </span>
      </div>
      <div className={textDim}>
        <span>{t('themeWorkbench.preview.cursorLabel')}</span>
        <span className="ml-2 inline-flex opacity-60">{cursor}</span>
      </div>
    </>
  )

  return {
    shell: shellPreview,
    logs: logsPreview,
    'git-diff': diffPreview,
    trace: tracePreview,
    ssh: sshPreview,
    unfocused: unfocusedPreview,
  }[scenario]
}
