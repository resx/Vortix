import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'

export type SettingTooltipPosition = {
  top: number
  left: number
}

export function extractDescText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim()
  if (Array.isArray(node)) return node.map(extractDescText).join(' ').trim()
  if (isValidElement<{ children?: ReactNode }>(node)) return extractDescText(node.props.children)
  return ''
}

export function extractLegacyDesc(children: ReactNode): { descText: string; content: ReactNode } {
  if (!isValidElement<{ children?: ReactNode; className?: string }>(children)) {
    return { descText: '', content: children }
  }

  const element = children as ReactElement<{ children?: ReactNode; className?: string }>
  const nodes = Children.toArray(element.props.children)
  if (nodes.length < 2) return { descText: '', content: children }

  const first = nodes[0]
  if (!isValidElement<{ className?: string; children?: ReactNode }>(first)) {
    return { descText: '', content: children }
  }

  const className = typeof first.props.className === 'string' ? first.props.className : ''
  const looksLikeDesc = className.includes('text-[11px]') && className.includes('text-text-3') && className.includes('truncate')
  if (!looksLikeDesc) return { descText: '', content: children }

  const descText = extractDescText(first.props.children)
  if (!descText) return { descText: '', content: children }

  const content = cloneElement(element, undefined, ...nodes.slice(1))
  return { descText, content }
}

export function resolveSettingTooltipPosition(
  trigger: HTMLButtonElement | null,
  tooltip: HTMLDivElement | null,
): SettingTooltipPosition | null {
  if (!trigger) return null

  const rect = trigger.getBoundingClientRect()
  const margin = 8
  const gap = 8
  const tooltipW = tooltip?.offsetWidth ?? 260
  const tooltipH = tooltip?.offsetHeight ?? 56

  let left = rect.left
  if (left + tooltipW > window.innerWidth - margin) left = window.innerWidth - tooltipW - margin
  if (left < margin) left = margin

  let top = rect.bottom + gap
  if (top + tooltipH > window.innerHeight - margin) {
    top = rect.top - tooltipH - gap
  }
  if (top < margin) top = margin

  return { top, left }
}
