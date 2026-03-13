/* ── 根据文件扩展名自动选择 CodeMirror 语言模式 ── */

import type { Extension } from '@codemirror/state'

const langLoaders: Record<string, () => Promise<Extension>> = {
  js: () => import('@codemirror/lang-javascript').then(m => m.javascript()),
  jsx: () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true })),
  ts: () => import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true })),
  tsx: () => import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true, typescript: true })),
  json: () => import('@codemirror/lang-json').then(m => m.json()),
  py: () => import('@codemirror/lang-python').then(m => m.python()),
  html: () => import('@codemirror/lang-html').then(m => m.html()),
  htm: () => import('@codemirror/lang-html').then(m => m.html()),
  css: () => import('@codemirror/lang-css').then(m => m.css()),
  scss: () => import('@codemirror/lang-css').then(m => m.css()),
  less: () => import('@codemirror/lang-css').then(m => m.css()),
  yaml: () => import('@codemirror/lang-yaml').then(m => m.yaml()),
  yml: () => import('@codemirror/lang-yaml').then(m => m.yaml()),
  xml: () => import('@codemirror/lang-xml').then(m => m.xml()),
  svg: () => import('@codemirror/lang-xml').then(m => m.xml()),
  sql: () => import('@codemirror/lang-sql').then(m => m.sql()),
  md: () => import('@codemirror/lang-markdown').then(m => m.markdown()),
  markdown: () => import('@codemirror/lang-markdown').then(m => m.markdown()),
}

/** 根据文件名获取语言扩展（懒加载） */
export async function getLanguageExtension(fileName: string): Promise<Extension | null> {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (!ext) return null
  const loader = langLoaders[ext]
  if (!loader) return null
  return loader()
}

/** 获取文件扩展名对应的语言名称（用于显示） */
export function getLanguageName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const nameMap: Record<string, string> = {
    js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX',
    json: 'JSON', py: 'Python', html: 'HTML', htm: 'HTML',
    css: 'CSS', scss: 'SCSS', less: 'Less',
    yaml: 'YAML', yml: 'YAML', xml: 'XML', svg: 'SVG',
    sql: 'SQL', md: 'Markdown', markdown: 'Markdown',
    sh: 'Shell', bash: 'Bash', zsh: 'Zsh',
    conf: 'Config', ini: 'INI', toml: 'TOML',
    txt: 'Text', log: 'Log',
  }
  return nameMap[ext] || ext.toUpperCase()
}
