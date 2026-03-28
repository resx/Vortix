import type { TerminalSession } from '../../../../stores/terminalSessionRegistry'
import type { WriteInlineFn } from './types'

export function createWriteInline(term: TerminalSession['term']): WriteInlineFn {
  const inlinePrefix = '\x1b[90m[Vortix]\x1b[0m'
  return (text: string, kind: 'info' | 'warn' | 'error' = 'info') => {
    const color = kind === 'error' ? '\x1b[31m' : kind === 'warn' ? '\x1b[33m' : '\x1b[36m'
    term.writeln(`\r\n${inlinePrefix} ${color}${text}\x1b[0m`)
  }
}
