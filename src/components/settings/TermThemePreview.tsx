import type { TermThemePreset } from '../terminal/themes/index'

/** 纯 HTML/CSS 模拟终端预览区 */
export default function TermThemePreview({
  preset,
  cursorStyle,
  cursorBlink,
}: {
  preset: TermThemePreset
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
}) {
  const t = preset.theme
  const bg = t.background ?? '#1E1E1E'
  const fg = t.foreground ?? '#D4D4D4'

  const cursorEl = (() => {
    const blinkClass = cursorBlink ? 'animate-[terminalBlink_1s_step-end_infinite]' : ''
    switch (cursorStyle) {
      case 'block':
        return <span className={`inline-block w-[8px] h-[14px] align-middle ${blinkClass}`} style={{ backgroundColor: t.cursor ?? fg }} />
      case 'underline':
        return <span className={`inline-block w-[8px] h-[2px] align-bottom ${blinkClass}`} style={{ backgroundColor: t.cursor ?? fg }} />
      case 'bar':
      default:
        return <span className={`inline-block w-[2px] h-[14px] align-middle ${blinkClass}`} style={{ backgroundColor: t.cursor ?? fg }} />
    }
  })()

  return (
    <div
      className="h-[180px] rounded-lg overflow-hidden font-mono text-[12px] leading-[20px] p-4 transition-colors duration-200 select-none"
      style={{ backgroundColor: bg, color: fg }}
    >
      {/* prompt 行 */}
      <div>
        <span style={{ color: t.green }}>user@vortix</span>
        <span style={{ color: fg }}>:</span>
        <span style={{ color: t.blue }}>~</span>
        <span style={{ color: fg }}>$ </span>
        <span style={{ color: fg }}>ls -la</span>
      </div>

      {/* 输出行 */}
      <div className="mt-0.5">
        <span style={{ color: t.blue }}>drwxr-xr-x</span>
        <span style={{ color: fg }}> 5 user user 4096 </span>
        <span style={{ color: t.cyan }}>src/</span>
      </div>
      <div>
        <span style={{ color: t.blue }}>drwxr-xr-x</span>
        <span style={{ color: fg }}> 3 user user 4096 </span>
        <span style={{ color: t.cyan }}>server/</span>
      </div>
      <div>
        <span style={{ color: t.green }}>-rwxr-xr-x</span>
        <span style={{ color: fg }}> 1 user user  512 </span>
        <span style={{ color: t.green }}>deploy.sh</span>
      </div>
      <div>
        <span style={{ color: fg }}>-rw-r--r-- 1 user user 1024 </span>
        <span style={{ color: t.yellow }}>package.json</span>
      </div>
      <div>
        <span style={{ color: t.red }}>-rw------- 1 user user  256 </span>
        <span style={{ color: t.red }}>.env</span>
      </div>

      {/* 光标行 */}
      <div className="mt-0.5">
        <span style={{ color: t.green }}>user@vortix</span>
        <span style={{ color: fg }}>:</span>
        <span style={{ color: t.blue }}>~</span>
        <span style={{ color: fg }}>$ </span>
        {cursorEl}
      </div>
    </div>
  )
}
