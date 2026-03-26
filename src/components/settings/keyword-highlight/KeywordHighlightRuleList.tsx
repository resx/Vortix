import { AppIcon, icons } from '../../icons/AppIcon'
import { ColorDot } from './KeywordHighlightColorField'
import type { KeywordHighlightPanelState } from './types'

export function KeywordHighlightRuleList({ state }: { state: KeywordHighlightPanelState }) {
  return (
    <div
      className={`custom-scrollbar max-h-[260px] flex-1 overflow-y-auto px-3 py-2 transition-opacity duration-300 ${
        !state.enabled ? 'pointer-events-none opacity-40' : ''
      }`}
    >
      {state.rules.map((item) => (
        <div
          key={item.rule.id}
          className={`group flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
            state.editingId === item.rule.id
              ? 'border-primary/25 bg-primary/8'
              : 'border-transparent hover:bg-bg-hover/60'
          }`}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <ColorDot color={item.displayColor} />
            <div className="min-w-0">
              <div className="truncate text-[12px] font-medium" style={{ color: item.displayColor }}>
                {item.rule.name}
              </div>
              <div className="mt-0.5 max-w-[200px] truncate font-mono text-[10px] text-text-3">
                {item.rule.pattern}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {item.rule.builtin && (
              <span className="mr-1 select-none rounded border border-border px-1 py-0.5 text-[9px] text-text-3">
                内置
              </span>
            )}
            <button
              type="button"
              onClick={() => state.handleEdit(item)}
              className="rounded-md p-1 text-text-3 hover:bg-bg-hover/70 hover:text-primary"
              title="编辑"
            >
              <AppIcon icon={icons.edit} size={13} />
            </button>
            {!item.rule.builtin && (
              <button
                type="button"
                onClick={() => state.handleDelete(item.rule.id)}
                className="rounded-md p-1 text-text-3 hover:bg-bg-hover/70 hover:text-status-error"
                title="删除"
              >
                <AppIcon icon={icons.trash} size={13} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
