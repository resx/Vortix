/* ── 文件类型图标映射 ── */

import { icons } from '../components/icons/AppIcon'

interface FileIconResult {
  icon: string
  color: string
}

const extMap: Record<string, FileIconResult> = {
  /* 代码 */
  ts: { icon: icons.fileCode, color: 'text-blue-400' },
  tsx: { icon: icons.fileCode, color: 'text-blue-400' },
  js: { icon: icons.fileCode, color: 'text-blue-400' },
  jsx: { icon: icons.fileCode, color: 'text-blue-400' },
  py: { icon: icons.fileCode, color: 'text-blue-400' },
  go: { icon: icons.fileCode, color: 'text-blue-400' },
  rs: { icon: icons.fileCode, color: 'text-blue-400' },
  java: { icon: icons.fileCode, color: 'text-blue-400' },
  c: { icon: icons.fileCode, color: 'text-blue-400' },
  cpp: { icon: icons.fileCode, color: 'text-blue-400' },
  h: { icon: icons.fileCode, color: 'text-blue-400' },
  vue: { icon: icons.fileCode, color: 'text-blue-400' },
  svelte: { icon: icons.fileCode, color: 'text-blue-400' },
  rb: { icon: icons.fileCode, color: 'text-blue-400' },
  php: { icon: icons.fileCode, color: 'text-blue-400' },
  css: { icon: icons.fileCode, color: 'text-blue-400' },
  scss: { icon: icons.fileCode, color: 'text-blue-400' },
  html: { icon: icons.fileCode, color: 'text-blue-400' },
  /* 配置 */
  json: { icon: icons.settings, color: 'text-amber-400' },
  yml: { icon: icons.settings, color: 'text-amber-400' },
  yaml: { icon: icons.settings, color: 'text-amber-400' },
  toml: { icon: icons.settings, color: 'text-amber-400' },
  env: { icon: icons.settings, color: 'text-amber-400' },
  ini: { icon: icons.settings, color: 'text-amber-400' },
  conf: { icon: icons.settings, color: 'text-amber-400' },
  xml: { icon: icons.settings, color: 'text-amber-400' },
  /* 文档 */
  md: { icon: icons.fileText, color: 'text-text-3' },
  txt: { icon: icons.fileText, color: 'text-text-3' },
  doc: { icon: icons.fileText, color: 'text-text-3' },
  docx: { icon: icons.fileText, color: 'text-text-3' },
  pdf: { icon: icons.fileText, color: 'text-text-3' },
  rtf: { icon: icons.fileText, color: 'text-text-3' },
  /* 图片 */
  png: { icon: icons.image, color: 'text-green-400' },
  jpg: { icon: icons.image, color: 'text-green-400' },
  jpeg: { icon: icons.image, color: 'text-green-400' },
  gif: { icon: icons.image, color: 'text-green-400' },
  svg: { icon: icons.image, color: 'text-green-400' },
  webp: { icon: icons.image, color: 'text-green-400' },
  ico: { icon: icons.image, color: 'text-green-400' },
  /* 压缩 */
  zip: { icon: icons.folderArchive, color: 'text-purple-400' },
  tar: { icon: icons.folderArchive, color: 'text-purple-400' },
  gz: { icon: icons.folderArchive, color: 'text-purple-400' },
  bz2: { icon: icons.folderArchive, color: 'text-purple-400' },
  xz: { icon: icons.folderArchive, color: 'text-purple-400' },
  rar: { icon: icons.folderArchive, color: 'text-purple-400' },
  '7z': { icon: icons.folderArchive, color: 'text-purple-400' },
  tgz: { icon: icons.folderArchive, color: 'text-purple-400' },
  /* 脚本 */
  sh: { icon: icons.terminalSquare, color: 'text-emerald-400' },
  bash: { icon: icons.terminalSquare, color: 'text-emerald-400' },
  zsh: { icon: icons.terminalSquare, color: 'text-emerald-400' },
  bat: { icon: icons.terminalSquare, color: 'text-emerald-400' },
  ps1: { icon: icons.terminalSquare, color: 'text-emerald-400' },
  /* 数据 */
  sql: { icon: icons.database, color: 'text-orange-400' },
  db: { icon: icons.database, color: 'text-orange-400' },
  sqlite: { icon: icons.database, color: 'text-orange-400' },
  csv: { icon: icons.database, color: 'text-orange-400' },
  /* 日志 */
  log: { icon: icons.scrollText, color: 'text-text-3/60' },
  /* 密钥 */
  pem: { icon: icons.key, color: 'text-red-400' },
  key: { icon: icons.key, color: 'text-red-400' },
  crt: { icon: icons.key, color: 'text-red-400' },
  cer: { icon: icons.key, color: 'text-red-400' },
  pub: { icon: icons.key, color: 'text-red-400' },
}

/** 可在内置编辑器中打开的文本文件扩展名 */
const TEXT_EXTENSIONS = new Set([
  // 代码
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h',
  'vue', 'svelte', 'rb', 'php', 'css', 'scss', 'less', 'html', 'htm', 'kt', 'swift',
  // 配置
  'json', 'jsonc', 'yml', 'yaml', 'toml', 'env', 'ini', 'conf', 'xml', 'properties',
  // 文档
  'md', 'txt', 'rtf', 'rst', 'adoc',
  // 脚本
  'sh', 'bash', 'zsh', 'bat', 'ps1', 'fish', 'makefile', 'dockerfile',
  // 数据
  'sql', 'csv', 'tsv', 'graphql', 'gql',
  // 日志
  'log',
  // 密钥（文本格式）
  'pem', 'pub', 'crt', 'cer',
])

/** 判断文件是否为文本文件（可在编辑器中打开） */
export function isTextFile(name: string): boolean {
  const lower = name.toLowerCase()
  // 无扩展名的常见文本文件
  const baseName = lower.split('/').pop() ?? lower
  if (['makefile', 'dockerfile', 'rakefile', 'gemfile', 'procfile', '.gitignore', '.env'].includes(baseName)) {
    return true
  }
  const ext = baseName.includes('.') ? baseName.split('.').pop()! : ''
  if (!ext) return true // 无扩展名默认当文本处理
  return TEXT_EXTENSIONS.has(ext)
}

const defaultFile: FileIconResult = { icon: icons.file, color: 'text-text-3' }
const dirIcon: FileIconResult = { icon: icons.folderOpen, color: 'text-icon-folder' }
const symlinkIcon: FileIconResult = { icon: icons.link, color: 'text-primary/70' }

/** 根据文件名和类型返回图标与颜色 */
export function getFileTypeIcon(
  name: string,
  type: 'file' | 'dir' | 'symlink',
): FileIconResult {
  if (type === 'dir') return dirIcon
  if (type === 'symlink') return symlinkIcon
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return extMap[ext] ?? defaultFile
}
