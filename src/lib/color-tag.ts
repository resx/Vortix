/* ── 颜色标签工具 ── */

const COLOR_TAG_TEXT_MAP: Record<string, string> = {
  'bg-red-500': 'text-red-500',
  'bg-orange-500': 'text-orange-500',
  'bg-yellow-400': 'text-yellow-500',
  'bg-green-500': 'text-green-500',
  'bg-cyan-500': 'text-cyan-500',
  'bg-blue-500': 'text-blue-500',
  'bg-purple-500': 'text-purple-500',
  'bg-gray-500': 'text-gray-500',
}

/** 获取颜色标签对应的文字颜色 class */
export function getColorTagTextClass(colorTag: string | null | undefined): string | undefined {
  if (!colorTag) return undefined
  return COLOR_TAG_TEXT_MAP[colorTag]
}

/** 获取颜色标签对应的圆点背景 class */
export function getColorTagDotClass(colorTag: string | null | undefined): string | undefined {
  if (!colorTag) return undefined
  return colorTag
}
