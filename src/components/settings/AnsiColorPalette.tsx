import type { ITheme } from '@xterm/xterm'

const ANSI_LABELS = [
  ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White'],
  ['Bright Black', 'Bright Red', 'Bright Green', 'Bright Yellow', 'Bright Blue', 'Bright Magenta', 'Bright Cyan', 'Bright White'],
] as const

function getAnsiColors(theme: ITheme): [string[], string[]] {
  const normal = [
    theme.black ?? '#000000',
    theme.red ?? '#CC0000',
    theme.green ?? '#00CC00',
    theme.yellow ?? '#CCCC00',
    theme.blue ?? '#0000CC',
    theme.magenta ?? '#CC00CC',
    theme.cyan ?? '#00CCCC',
    theme.white ?? '#CCCCCC',
  ]
  const bright = [
    theme.brightBlack ?? '#555555',
    theme.brightRed ?? '#FF0000',
    theme.brightGreen ?? '#00FF00',
    theme.brightYellow ?? '#FFFF00',
    theme.brightBlue ?? '#0000FF',
    theme.brightMagenta ?? '#FF00FF',
    theme.brightCyan ?? '#00FFFF',
    theme.brightWhite ?? '#FFFFFF',
  ]
  return [normal, bright]
}

export default function AnsiColorPalette({ theme }: { theme: ITheme }) {
  const [normal, bright] = getAnsiColors(theme)

  return (
    <div className="space-y-1">
      <div className="text-[11px] text-text-2 mb-1.5">ANSI 色板</div>
      {[normal, bright].map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((color, ci) => (
            <div key={ci} className="group relative flex-1">
              <div
                className="h-[20px] rounded-[3px] transition-transform group-hover:scale-110"
                style={{ backgroundColor: color }}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded bg-text-1 text-white text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {ANSI_LABELS[ri][ci]}
                <span className="ml-1 opacity-70">{color}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
