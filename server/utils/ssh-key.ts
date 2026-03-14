/**
 * 规范化 SSH 私钥格式
 * 处理从单行输入框粘贴导致换行丢失的情况
 */
export function normalizeSshKey(raw: string): string {
  let key = raw.trim().replace(/\r\n/g, '\n')

  // 已经是正常多行格式
  if (key.includes('\n')) {
    return key.endsWith('\n') ? key : key + '\n'
  }

  // 单行格式修复：提取 header/footer 之间的 base64 内容并按 70 字符折行
  const match = key.match(/^(-----BEGIN [A-Z0-9 ]+ KEY-----)\s*(.*?)\s*(-----END [A-Z0-9 ]+ KEY-----)$/)
  if (match) {
    const [, header, body, footer] = match
    const cleaned = body.replace(/\s+/g, '')
    const lines = cleaned.match(/.{1,70}/g) || []
    return [header, ...lines, footer, ''].join('\n')
  }

  // 无法识别格式，原样返回并确保末尾换行
  return key.endsWith('\n') ? key : key + '\n'
}
