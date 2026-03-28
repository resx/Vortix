import { WebLinksAddon } from '@xterm/addon-web-links'
import { open } from '@tauri-apps/plugin-shell'
import type { IDisposable, ILink, ILinkProvider, Terminal } from '@xterm/xterm'

const WINDOWS_PATH_REGEX = /(?:[A-Za-z]:[\\/](?:[^\\/:*?"<>|\r\n\t ]+[\\/])*[^\\/:*?"<>|\r\n\t ]+)/g
const WINDOWS_FILE_URI_REGEX = /file:\/\/\/[A-Za-z]:\/[^\s"'`<>]+/g

interface TerminalLinkBehavior {
  activate: (event: MouseEvent, uri: string) => void
  hover: (uri: string) => void
  leave: () => void
}

export interface TerminalLinkSupport extends IDisposable {
  enableLocalPathLinks: boolean
}

function isModifierPressed(event: MouseEvent): boolean {
  return event.ctrlKey || event.metaKey
}

function getModifierLabel(): string {
  return navigator.platform.toUpperCase().includes('MAC') ? 'Cmd' : 'Ctrl'
}

function createTerminalLinkBehavior(term: Terminal): TerminalLinkBehavior {
  return {
    activate: (event, uri) => {
      if (!isModifierPressed(event)) return
      window.open(uri, '_blank', 'noopener')
    },
    hover: (uri) => {
      term.element?.setAttribute('title', `${getModifierLabel()}+Click 打开链接: ${uri}`)
    },
    leave: () => {
      term.element?.removeAttribute('title')
    },
  }
}

function readBufferLine(term: Terminal, bufferLineNumber: number): string {
  const line = term.buffer.active.getLine(bufferLineNumber - 1)
  return line?.translateToString(true) ?? ''
}

function normalizeLocalPathTarget(raw: string): string {
  if (raw.startsWith('file:///')) {
    return decodeURIComponent(raw.slice('file:///'.length)).replaceAll('/', '\\')
  }
  return raw
}

function createPathLink(text: string, y: number, startIndex: number, behavior: TerminalLinkBehavior): ILink {
  return {
    text,
    range: {
      start: { x: startIndex + 1, y },
      end: { x: startIndex + text.length + 1, y },
    },
    decorations: {
      pointerCursor: true,
      underline: true,
    },
    activate: (event, rawText) => {
      if (!isModifierPressed(event)) return
      void open(normalizeLocalPathTarget(rawText)).catch((error) => {
        console.warn('[Vortix] 打开本地路径失败', rawText, error)
      })
    },
    hover: (_event, rawText) => {
      behavior.hover(rawText)
    },
    leave: () => {
      behavior.leave()
    },
  }
}

function linkIdentity(text: string, y: number, startIndex: number): string {
  return `${y}:${startIndex}:${text}`
}

function collectPathLinks(line: string, bufferLineNumber: number, behavior: TerminalLinkBehavior): ILink[] {
  const links: ILink[] = []
  const seen = new Set<string>()
  for (const regex of [WINDOWS_FILE_URI_REGEX, WINDOWS_PATH_REGEX]) {
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(line)) !== null) {
      const text = match[0]
      if (!text) continue
      const identity = linkIdentity(text, bufferLineNumber, match.index)
      if (seen.has(identity)) continue
      seen.add(identity)
      links.push(createPathLink(text, bufferLineNumber, match.index, behavior))
    }
  }
  return links
}

function createLocalPathLinkProvider(term: Terminal, behavior: TerminalLinkBehavior): ILinkProvider {
  return {
    provideLinks(bufferLineNumber, callback) {
      const line = readBufferLine(term, bufferLineNumber)
      if (!line) {
        callback(undefined)
        return
      }
      const links = collectPathLinks(line, bufferLineNumber, behavior)
      callback(links.length > 0 ? links : undefined)
    },
  }
}

function createWebLinksAddon(behavior: TerminalLinkBehavior): WebLinksAddon {
  return new WebLinksAddon((event, uri) => {
    behavior.activate(event, uri)
  }, {
    hover: (_event, uri) => {
      behavior.hover(uri)
    },
    leave: () => {
      behavior.leave()
    },
  })
}

function clearTerminalLinkState(term: Terminal): void {
  term.element?.removeAttribute('title')
  term.options.linkHandler = undefined
}

function buildTerminalLinkSupport(
  term: Terminal,
  behavior: TerminalLinkBehavior,
  enableLocalPathLinks: boolean,
): TerminalLinkSupport {
  const webLinksAddon = createWebLinksAddon(behavior)
  const localPathProvider = enableLocalPathLinks
    ? term.registerLinkProvider(createLocalPathLinkProvider(term, behavior))
    : null

  term.loadAddon(webLinksAddon)

  return {
    enableLocalPathLinks,
    dispose: () => {
      localPathProvider?.dispose()
      webLinksAddon.dispose()
      clearTerminalLinkState(term)
    },
  }
}

export function installTerminalLinkSupport(
  term: Terminal,
  current: TerminalLinkSupport | null,
  options?: { enableLocalPathLinks?: boolean },
): TerminalLinkSupport {
  const enableLocalPathLinks = Boolean(options?.enableLocalPathLinks)
  if (current && current.enableLocalPathLinks === enableLocalPathLinks) {
    return current
  }

  current?.dispose()

  const behavior = createTerminalLinkBehavior(term)
  term.options.linkHandler = {
    activate: (event, text) => {
      behavior.activate(event, text)
    },
    hover: (_event, text) => {
      behavior.hover(text)
    },
    leave: () => {
      behavior.leave()
    },
  }

  return buildTerminalLinkSupport(term, behavior, enableLocalPathLinks)
}
