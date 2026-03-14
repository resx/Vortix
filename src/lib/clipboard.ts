/* ── 跨环境剪贴板工具 ── */
/* CEF 桌面端 navigator.clipboard 在窗口失焦时可能抛异常，统一降级处理 */

/** 安全写入剪贴板：优先 navigator.clipboard，降级 execCommand */
export function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => execCommandCopy(text))
  }
  execCommandCopy(text)
  return Promise.resolve()
}

/** 安全读取剪贴板 */
export function readClipboard(): Promise<string> {
  if (navigator.clipboard?.readText) {
    return navigator.clipboard.readText().catch(() => '')
  }
  return Promise.resolve('')
}

/** execCommand 降级复制 */
function execCommandCopy(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;opacity:0;left:-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}
