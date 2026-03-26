import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SuggestionCandidate } from '../../../lib/terminal-suggestions'

interface TerminalSuggestionOverlayProps {
  visible: boolean
  candidates: SuggestionCandidate[]
  activeIndex: number
  fontFamily: string
  fontSize: number
  anchorX: number
  anchorY: number
  cellHeight: number
  onSelect: (index: number) => void
  onAccept: (index: number) => void
}

function sourceLabel(source: SuggestionCandidate['source']): string {
  switch (source) {
    case 'history':
      return '历史'
    case 'snippet':
      return '快捷命令'
    case 'command-spec':
      return '命令参数'
    default:
      return source
  }
}

function TerminalGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 5.5L6.5 8L4 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function sourceTone(source: SuggestionCandidate['source']): string {
  switch (source) {
    case 'history':
      return '#64748b'
    case 'snippet':
      return '#0ea5e9'
    case 'command-spec':
      return '#52525b'
    default:
      return '#71717a'
  }
}

export default function TerminalSuggestionOverlay({
  visible,
  candidates,
  activeIndex,
  fontFamily,
  fontSize,
  anchorX,
  anchorY,
  cellHeight,
  onSelect,
  onAccept,
}: TerminalSuggestionOverlayProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ left: anchorX, top: anchorY + 6 })
  const activeItemRef = useRef<HTMLLIElement | null>(null)
  const tone = useMemo(() => sourceTone(candidates[activeIndex]?.source ?? 'command-spec'), [activeIndex, candidates])

  useLayoutEffect(() => {
    if (!visible || candidates.length === 0) return
    const menuEl = menuRef.current
    if (!menuEl) return
    const gap = 8
    const viewPadding = 8
    const menuHeight = menuEl.offsetHeight
    const menuWidth = menuEl.offsetWidth

    // Keep the menu slightly away from the cursor block for better readability.
    let left = anchorX + 6
    left = Math.max(viewPadding, Math.min(left, window.innerWidth - menuWidth - viewPadding))

    let top = anchorY + gap
    if (top + menuHeight > window.innerHeight - viewPadding) {
      top = anchorY - menuHeight - cellHeight - gap
    }
    top = Math.max(viewPadding, top)

    setPosition({ left, top })
  }, [activeIndex, anchorX, anchorY, candidates.length, cellHeight, visible])

  useLayoutEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, visible])

  if (!visible || candidates.length === 0) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed z-20 pointer-events-none" style={{ left: `${position.left}px`, top: `${position.top}px` }}>
      <div
        ref={menuRef}
        className="pointer-events-auto overflow-hidden"
        style={{
          width: '520px',
          minWidth: '420px',
          maxWidth: 'min(94vw, 760px)',
          maxHeight: '300px',
          borderRadius: '8px',
          border: '1px solid rgba(0, 0, 0, 0.04)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(10px)',
          backgroundColor: '#f4f4f5',
          padding: '6px',
          boxSizing: 'border-box',
        }}
      >
        <style>
          {`
            .vortix-autocomplete-list::-webkit-scrollbar {
              width: 8px;
            }
            .vortix-autocomplete-list::-webkit-scrollbar-track {
              background: transparent;
              margin: 4px 0;
            }
            .vortix-autocomplete-list::-webkit-scrollbar-thumb {
              background-color: #c1c1c1;
              border-radius: 10px;
              border: 2px solid #f4f4f5;
            }
            .vortix-autocomplete-list::-webkit-scrollbar-thumb:hover {
              background-color: #a8a8a8;
            }
          `}
        </style>
        <ul className="vortix-autocomplete-list overflow-y-auto p-0" style={{ maxHeight: '300px' }}>
          {candidates.map((candidate, index) => {
            const active = index === activeIndex
            return (
              <li
                key={candidate.id}
                ref={active ? activeItemRef : null}
                className={`cursor-pointer transition-all duration-150 ${
                  active ? 'bg-[#e4e4e7]' : 'hover:bg-[#e4e4e7]'
                }`}
                style={{ borderRadius: '6px', padding: '8px 10px' }}
                onMouseEnter={() => onSelect(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onAccept(index)
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex shrink-0 items-center justify-center rounded"
                    style={{ width: '20px', color: tone, marginRight: '8px', fontSize: '12px' }}
                    title={sourceLabel(candidate.source)}
                  >
                    <TerminalGlyph />
                  </span>
                  <span
                    className="font-semibold text-[#27272a] truncate mr-3"
                    style={{ fontFamily, fontSize: `${fontSize}px` }}
                  >
                    {candidate.displayText || candidate.text}
                  </span>
                  <span
                    className="ml-auto text-right"
                    style={{
                      fontFamily,
                      fontSize: `${fontSize}px`,
                      color: '#71717a',
                      maxWidth: '56%',
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      lineHeight: 1.35,
                    }}
                  >
                    {candidate.description ?? ''}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
