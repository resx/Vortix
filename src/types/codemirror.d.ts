declare module '@codemirror/state' {
  export type Extension = unknown

  export class EditorState {
    static create(config: { doc?: string; extensions?: Extension[] }): EditorState
    static tabSize: { of: (size: number) => Extension }
    doc: { toString(): string }
  }
}

declare module '@codemirror/view' {
  import type { EditorState, Extension } from '@codemirror/state'

  export interface ViewUpdate {
    docChanged: boolean
  }

  export class EditorView {
    constructor(config: { state: EditorState; parent: Element })
    state: EditorState
    destroy(): void
    static updateListener: { of: (fn: (update: ViewUpdate) => void) => Extension }
    static theme: (spec: Record<string, Record<string, string | number>>) => Extension
    static lineWrapping: Extension
  }

  export const keymap: { of: (bindings: unknown[]) => Extension }
  export function lineNumbers(): Extension
  export function highlightActiveLine(): Extension
  export function highlightActiveLineGutter(): Extension
}

declare module '@codemirror/commands' {
  import type { Extension } from '@codemirror/state'

  export const defaultKeymap: unknown[]
  export const historyKeymap: unknown[]
  export function history(): Extension
}

declare module '@codemirror/theme-one-dark' {
  import type { Extension } from '@codemirror/state'
  export const oneDark: Extension
}

declare module '@codemirror/lang-javascript' {
  import type { Extension } from '@codemirror/state'
  export function javascript(config?: { jsx?: boolean; typescript?: boolean }): Extension
}

declare module '@codemirror/lang-json' {
  import type { Extension } from '@codemirror/state'
  export function json(): Extension
}

declare module '@codemirror/lang-python' {
  import type { Extension } from '@codemirror/state'
  export function python(): Extension
}

declare module '@codemirror/lang-html' {
  import type { Extension } from '@codemirror/state'
  export function html(): Extension
}

declare module '@codemirror/lang-css' {
  import type { Extension } from '@codemirror/state'
  export function css(): Extension
}

declare module '@codemirror/lang-yaml' {
  import type { Extension } from '@codemirror/state'
  export function yaml(): Extension
}

declare module '@codemirror/lang-xml' {
  import type { Extension } from '@codemirror/state'
  export function xml(): Extension
}

declare module '@codemirror/lang-sql' {
  import type { Extension } from '@codemirror/state'
  export function sql(): Extension
}

declare module '@codemirror/lang-markdown' {
  import type { Extension } from '@codemirror/state'
  export function markdown(): Extension
}
