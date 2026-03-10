/* ── 右键菜单共享工具 ── */

/** 下载 JSON 文件 */
export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 选择并读取 JSON 文件 */
export function pickJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { reject(new Error('cancelled')); return }
      const reader = new FileReader()
      reader.onload = () => {
        try { resolve(JSON.parse(reader.result as string)) }
        catch { reject(new Error('invalid json')) }
      }
      reader.readAsText(file)
    }
    input.click()
  })
}

/** 连接剪贴板（跨菜单共享） */
export let connClipboard: { ids: string[]; op: 'copy' | 'cut' } | null = null
export function setConnClipboard(v: typeof connClipboard) { connClipboard = v }
