import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, icons } from '../icons/AppIcon'

function extractDescText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim()
  if (Array.isArray(node)) return node.map(extractDescText).join(' ').trim()
  if (isValidElement<{ children?: ReactNode }>(node)) return extractDescText(node.props.children)
  return ''
}

function extractLegacyDesc(children: ReactNode): { descText: string; content: ReactNode } {
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

/* 设置项行（左标签，右控件容器） */
export function SettingRow({ label, desc, children }: {
  label: string
  desc?: ReactNode
  children: ReactNode
}) {
  const explicitDesc = useMemo(() => extractDescText(desc), [desc])
  const legacy = useMemo(() => extractLegacyDesc(children), [children])
  const descText = explicitDesc || legacy.descText
  const hasDesc = descText.length > 0
  const [open, setOpen] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const updateTooltipPosition = () => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const margin = 8
    const gap = 8
    const tooltipW = tooltipRef.current?.offsetWidth ?? 260
    const tooltipH = tooltipRef.current?.offsetHeight ?? 56

    let left = rect.left
    if (left + tooltipW > window.innerWidth - margin) left = window.innerWidth - tooltipW - margin
    if (left < margin) left = margin

    let top = rect.bottom + gap
    if (top + tooltipH > window.innerHeight - margin) {
      top = rect.top - tooltipH - gap
    }
    if (top < margin) top = margin

    setTooltipPos({ top, left })
  }

  const openTooltip = () => {
    // 先基于触发点给出初始坐标，避免首次渲染闪到左上角
    updateTooltipPosition()
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const raf = window.requestAnimationFrame(updateTooltipPosition)
    const onRelayout = () => updateTooltipPosition()
    window.addEventListener('resize', onRelayout)
    window.addEventListener('scroll', onRelayout, true)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', onRelayout)
      window.removeEventListener('scroll', onRelayout, true)
    }
  }, [open])

  return (
    <div className="group island-row flex justify-between items-center px-4 py-1.5 gap-3 mb-0.5 last:mb-0">
      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
        <span className="text-[12px] text-text-2 font-medium whitespace-nowrap">{label}</span>
        {hasDesc && (
          <>
            <button
              ref={triggerRef}
              type="button"
              className="w-[16px] h-[16px] rounded-full border border-border/80 bg-bg-base/85 text-text-3 hover:text-primary hover:border-primary/30 transition-colors flex items-center justify-center"
              aria-label={`${label} 说明`}
              onMouseEnter={openTooltip}
              onMouseLeave={() => setOpen(false)}
              onFocus={openTooltip}
              onBlur={() => setOpen(false)}
            >
              <AppIcon icon={icons.info} size={10} />
            </button>
            {open && createPortal(
              <div
                ref={tooltipRef}
                className="pointer-events-none fixed z-[1400] w-[260px] rounded-lg border border-border/80 bg-bg-card/96 px-2.5 py-2 text-[11px] leading-[1.45] text-text-2 shadow-[0_10px_24px_rgba(0,0,0,0.12)] backdrop-blur-md"
                style={{ top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px` }}
              >
                {descText}
              </div>,
              document.body,
            )}
          </>
        )}
      </div>
      <div className="flex items-center justify-end flex-1 min-w-0">
        <div className="w-full min-w-0 flex items-center justify-end [&>*]:max-w-full">{legacy.content}</div>
      </div>
    </div>
  )
}

/* Excel 风格设置分组容器 */
export function SettingGroup({ children }: { children: ReactNode }) {
  return (
    <div className="island-surface self-start flex flex-col p-1 min-w-0 max-w-full overflow-hidden">
      {children}
    </div>
  )
}
