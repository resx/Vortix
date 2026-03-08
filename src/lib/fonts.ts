/** 设置 store 中的字体 key → CSS font-family 映射 */
export const FONT_MAP: Record<string, string> = {
  system: 'system-ui, -apple-system, sans-serif',
  JetBrainsMono: "'JetBrains Mono Variable', 'JetBrains Mono', monospace",
  CascadiaCode: "'Cascadia Code', monospace",
  CascadiaMono: "'Cascadia Mono', monospace",
  FiraCode: "'Fira Code', monospace",
  Consolas: "Consolas, monospace",
  SourceCodePro: "'Source Code Pro', monospace",
  Inconsolata: "'Inconsolata', monospace",
  RobotoMono: "'Roboto Mono', monospace",
  UbuntuMono: "'Ubuntu Mono', monospace",
  IBMPlexMono: "'IBM Plex Mono', monospace",
  Hack: "'Hack', monospace",
  VictorMono: "'Victor Mono', monospace",
  NotoSansMono: "'Noto Sans Mono', monospace",
  SpaceMono: "'Space Mono', monospace",
  AnonymousPro: "'Anonymous Pro', monospace",
  Cousine: "'Cousine', monospace",
  NotoSansSC: "'Noto Sans SC Variable', 'Noto Sans SC', 'Source Han Sans SC', sans-serif",
  monospace: 'monospace',
  serif: 'serif',
  'sans-serif': 'sans-serif',
  cursive: 'cursive',
  fantasy: 'fantasy',
}

/** 将字体 key 数组解析为 CSS font-family fallback 链 */
export function resolveFontChain(keys: string[], fallback = 'monospace'): string {
  if (keys.length === 0) return fallback
  const chain = keys
    .map(k => FONT_MAP[k] || `"${k}"`)
    .join(', ')
  // 追加 Unicode 覆盖良好的等宽字体，确保 box-drawing 等特殊字符正常渲染
  return `${chain}, 'Cascadia Code', Consolas, 'DejaVu Sans Mono', ${fallback}`
}
