/* ── 外部编辑器启动逻辑 ── */
/* 支持 VSCode/Notepad++/Sublime Text/系统默认/自定义命令 */

export type EditorType = 'builtin' | 'system' | 'vscode' | 'notepad++' | 'sublime' | 'custom'

interface EditorConfig {
  type: EditorType
  customCommand?: string
}

/** 获取编辑器启动命令 */
function getEditorCommand(config: EditorConfig, filePath: string): string | null {
  switch (config.type) {
    case 'builtin':
      return null // 内置编辑器不需要外部命令
    case 'system':
      return `start "" "${filePath}"`
    case 'vscode':
      return `code "${filePath}"`
    case 'notepad++':
      return `"C:\\Program Files\\Notepad++\\notepad++.exe" "${filePath}"`
    case 'sublime':
      return `subl "${filePath}"`
    case 'custom':
      return config.customCommand
        ? config.customCommand.replace('{file}', filePath)
        : null
    default:
      return null
  }
}

/** 通过后端 API 启动外部编辑器 */
export async function launchExternalEditor(
  remotePath: string,
  editorConfig: EditorConfig,
): Promise<void> {
  const resp = await fetch('/api/editor/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      remotePath,
      editorType: editorConfig.type,
      customCommand: editorConfig.customCommand,
    }),
  })
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ error: '启动编辑器失败' }))
    throw new Error(data.error || '启动编辑器失败')
  }
}

/** 判断是否使用内置编辑器 */
export function isBuiltinEditor(type: EditorType): boolean {
  return type === 'builtin'
}

export { getEditorCommand }
