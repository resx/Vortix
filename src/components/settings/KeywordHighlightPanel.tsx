import { KeywordHighlightEditor } from './keyword-highlight/KeywordHighlightEditor'
import { KeywordHighlightRuleList } from './keyword-highlight/KeywordHighlightRuleList'
import { useKeywordHighlightPanelState } from './keyword-highlight/useKeywordHighlightPanelState'

export default function KeywordHighlightPanel() {
  const state = useKeywordHighlightPanelState()

  return (
    <div className="island-surface flex flex-col overflow-hidden rounded-2xl">
      <div className="border-b border-border/50 px-5 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-widest text-text-3">
            终端关键词高亮
          </div>
          <div className="flex items-center gap-2">
            <span className="select-none text-[11px] text-text-3">启用</span>
            <button
              type="button"
              onClick={state.toggleEnabled}
              className={`relative h-5 w-9 rounded-full transition-colors duration-300 ${
                state.enabled ? 'bg-primary' : 'bg-border'
              }`}
            >
              <div
                className={`absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white transition-transform duration-300 ${
                  state.enabled ? 'translate-x-[20px]' : 'translate-x-[4px]'
                }`}
              />
            </button>
          </div>
        </div>
        <div className="mt-2 text-[11px] leading-5 text-text-3">
          内置规则颜色跟随当前终端主题，只在主题管理器维护；这里仅编辑匹配规则，自定义规则可单独指定颜色。
        </div>
      </div>

      <KeywordHighlightRuleList state={state} />
      <KeywordHighlightEditor state={state} />
    </div>
  )
}
