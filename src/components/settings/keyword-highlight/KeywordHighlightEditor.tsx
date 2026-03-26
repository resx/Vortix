import { AppIcon, icons } from '../../icons/AppIcon'
import { ColorPicker } from './KeywordHighlightColorField'
import type { KeywordHighlightPanelState } from './types'

export function KeywordHighlightEditor({ state }: { state: KeywordHighlightPanelState }) {
  return (
    <>
      <div className={`bg-bg-subtle/60 px-5 pb-2.5 pt-3 transition-colors ${!state.enabled ? 'pointer-events-none opacity-40' : ''}`}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-text-3">
            {state.editingId ? '编辑规则' : '新增规则'}
          </span>
          {state.editingId && (
            <button
              type="button"
              onClick={state.handleCancelEdit}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-3 hover:text-text-1"
            >
              <AppIcon icon={icons.close} size={11} />
              取消
            </button>
          )}
        </div>
        <div className="flex items-stretch gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <input
              type="text"
              value={state.formName}
              onChange={(event) => state.setFormName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && state.handleSave()}
              placeholder="名称（如 Error）"
              className="island-control w-full px-2.5 py-1.5 text-[12px] placeholder:text-text-disabled"
            />
            <input
              type="text"
              value={state.formPattern}
              onChange={(event) => state.setFormPattern(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && state.handleSave()}
              placeholder="正则（如 \bfailed\b），留空则自动生成"
              className="island-control w-full px-2.5 py-1.5 font-mono text-[12px] placeholder:font-sans placeholder:text-text-disabled"
            />
          </div>
          <div className="flex w-[36px] flex-col gap-1.5">
            <ColorPicker value={state.formColor} onChange={state.setFormColor} />
            <button
              type="button"
              onClick={state.handleSave}
              disabled={!state.formName.trim()}
              className={`flex h-[28px] w-full items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                state.editingId
                  ? 'bg-primary/15 text-primary hover:bg-primary hover:text-white'
                  : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
              }`}
              title={state.editingId ? '保存' : '新增'}
            >
              <AppIcon icon={state.editingId ? icons.check : icons.plus} size={16} />
            </button>
          </div>
        </div>
      </div>

      {state.hasCustomRules && (
        <div className={`flex items-center justify-end border-t border-border/50 bg-bg-subtle/60 px-5 py-2 ${!state.enabled ? 'pointer-events-none opacity-40' : ''}`}>
          <button
            type="button"
            onClick={state.handleClearCustom}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-text-3 transition-colors hover:bg-bg-hover/50 hover:text-text-1"
          >
            <AppIcon icon={icons.rotateCw} size={12} />
            清除所有自定义规则
          </button>
        </div>
      )}
    </>
  )
}
