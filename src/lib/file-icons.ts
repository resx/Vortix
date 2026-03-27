/* ── 文件类型图标映射 ── */

import { icons } from '../components/icons/AppIcon'

interface FileIconResult {
  icon: string
  color: string
}

const baseNameMap: Record<string, FileIconResult> = {
  dockerfile: { icon: icons.container, color: 'text-sky-500' },
  'docker-compose.yml': { icon: icons.container, color: 'text-sky-500' },
  'docker-compose.yaml': { icon: icons.container, color: 'text-sky-500' },
  makefile: { icon: icons.terminalSquare, color: 'text-emerald-400' },
  readme: { icon: icons.fileText, color: 'text-text-2' },
  'readme.md': { icon: icons.fileText, color: 'text-text-2' },
  license: { icon: icons.fileText, color: 'text-text-2' },
  'license.txt': { icon: icons.fileText, color: 'text-text-2' },
  changelog: { icon: icons.scrollText, color: 'text-text-3' },
  'changelog.md': { icon: icons.scrollText, color: 'text-text-3' },
  '.gitignore': { icon: icons.settings, color: 'text-amber-400' },
  '.gitattributes': { icon: icons.settings, color: 'text-amber-400' },
  '.editorconfig': { icon: icons.settings, color: 'text-amber-400' },
  '.npmrc': { icon: icons.settings, color: 'text-amber-400' },
  '.yarnrc': { icon: icons.settings, color: 'text-amber-400' },
  '.env': { icon: icons.settings, color: 'text-amber-400' },
  '.env.local': { icon: icons.settings, color: 'text-amber-400' },
  '.env.development': { icon: icons.settings, color: 'text-amber-400' },
  '.env.production': { icon: icons.settings, color: 'text-amber-400' },
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
  xls: { icon: icons.fileText, color: 'text-emerald-500' },
  xlsx: { icon: icons.fileText, color: 'text-emerald-500' },
  ppt: { icon: icons.fileText, color: 'text-orange-500' },
  pptx: { icon: icons.fileText, color: 'text-orange-500' },
  pdf: { icon: icons.fileText, color: 'text-text-3' },
  rtf: { icon: icons.fileText, color: 'text-text-3' },
  odt: { icon: icons.fileText, color: 'text-text-3' },
  ods: { icon: icons.fileText, color: 'text-emerald-500' },
  odp: { icon: icons.fileText, color: 'text-orange-500' },
  /* 图片 */
  png: { icon: icons.image, color: 'text-green-400' },
  jpg: { icon: icons.image, color: 'text-green-400' },
  jpeg: { icon: icons.image, color: 'text-green-400' },
  gif: { icon: icons.image, color: 'text-green-400' },
  svg: { icon: icons.image, color: 'text-green-400' },
  webp: { icon: icons.image, color: 'text-green-400' },
  ico: { icon: icons.image, color: 'text-green-400' },
  bmp: { icon: icons.image, color: 'text-green-400' },
  tiff: { icon: icons.image, color: 'text-green-400' },
  heic: { icon: icons.image, color: 'text-green-400' },
  psd: { icon: icons.image, color: 'text-indigo-400' },
  ai: { icon: icons.image, color: 'text-orange-500' },
  /* 视频 */
  mp4: { icon: icons.play, color: 'text-pink-400' },
  mkv: { icon: icons.play, color: 'text-pink-400' },
  mov: { icon: icons.play, color: 'text-pink-400' },
  avi: { icon: icons.play, color: 'text-pink-400' },
  webm: { icon: icons.play, color: 'text-pink-400' },
  flv: { icon: icons.play, color: 'text-pink-400' },
  m4v: { icon: icons.play, color: 'text-pink-400' },
  /* 音频 */
  mp3: { icon: icons.activity, color: 'text-fuchsia-400' },
  wav: { icon: icons.activity, color: 'text-fuchsia-400' },
  flac: { icon: icons.activity, color: 'text-fuchsia-400' },
  aac: { icon: icons.activity, color: 'text-fuchsia-400' },
  ogg: { icon: icons.activity, color: 'text-fuchsia-400' },
  m4a: { icon: icons.activity, color: 'text-fuchsia-400' },
  /* 压缩 */
  zip: { icon: icons.folderArchive, color: 'text-purple-400' },
  tar: { icon: icons.folderArchive, color: 'text-purple-400' },
  gz: { icon: icons.folderArchive, color: 'text-purple-400' },
  bz2: { icon: icons.folderArchive, color: 'text-purple-400' },
  xz: { icon: icons.folderArchive, color: 'text-purple-400' },
  rar: { icon: icons.folderArchive, color: 'text-purple-400' },
  '7z': { icon: icons.folderArchive, color: 'text-purple-400' },
  tgz: { icon: icons.folderArchive, color: 'text-purple-400' },
  zst: { icon: icons.folderArchive, color: 'text-purple-400' },
  /* 二进制与安装包 */
  exe: { icon: icons.appWindow, color: 'text-slate-500' },
  msi: { icon: icons.appWindow, color: 'text-slate-500' },
  dmg: { icon: icons.appWindow, color: 'text-slate-500' },
  pkg: { icon: icons.appWindow, color: 'text-slate-500' },
  app: { icon: icons.appWindow, color: 'text-slate-500' },
  deb: { icon: icons.container, color: 'text-sky-500' },
  rpm: { icon: icons.container, color: 'text-sky-500' },
  apk: { icon: icons.container, color: 'text-sky-500' },
  /* 字体 */
  ttf: { icon: icons.fileText, color: 'text-violet-500' },
  otf: { icon: icons.fileText, color: 'text-violet-500' },
  woff: { icon: icons.fileText, color: 'text-violet-500' },
  woff2: { icon: icons.fileText, color: 'text-violet-500' },
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
  out: { icon: icons.scrollText, color: 'text-text-3/60' },
  /* 密钥 */
  pem: { icon: icons.key, color: 'text-red-400' },
  key: { icon: icons.key, color: 'text-red-400' },
  crt: { icon: icons.key, color: 'text-red-400' },
  cer: { icon: icons.key, color: 'text-red-400' },
  pub: { icon: icons.key, color: 'text-red-400' },
  p12: { icon: icons.key, color: 'text-red-400' },
  pfx: { icon: icons.key, color: 'text-red-400' },
  /* 容器与编排 */
  dockerfile: { icon: icons.container, color: 'text-sky-500' },
  compose: { icon: icons.container, color: 'text-sky-500' },
  lock: { icon: icons.lock, color: 'text-amber-500' },
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
  const baseName = name.split('/').pop()?.split('\\').pop()?.toLowerCase() ?? name.toLowerCase()
  const matchedBase = baseNameMap[baseName]
  if (matchedBase) return matchedBase
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return extMap[ext] ?? defaultFile
}
