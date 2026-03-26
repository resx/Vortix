import { AppIcon, icons } from '../icons/AppIcon'
import IslandModal from '../ui/island-modal'
import { KeyPickerEditView } from './key-picker/KeyPickerEditView'
import { KeyPickerGenerateView } from './key-picker/KeyPickerGenerateView'
import { KeyPickerImportView } from './key-picker/KeyPickerImportView'
import { KeyPickerListView } from './key-picker/KeyPickerListView'
import type { KeyPickerModalProps } from './key-picker/types'
import { useKeyPickerState } from './key-picker/useKeyPickerState'

export default function KeyPickerModal({ onSelect, onClose }: KeyPickerModalProps) {
  const state = useKeyPickerState()

  return (
    <IslandModal
      title={state.tabTitle}
      isOpen
      onClose={onClose}
      width="max-w-2xl"
      padding="p-0"
      footer={state.tab === 'list' ? <div className="text-[11px] text-text-3">支持选择、导出、编辑、删除和导入 SSH 密钥</div> : <div />}
    >
      <div className="flex gap-1 border-b border-border/50 px-4 pt-3">
        {state.tab === 'edit' ? (
          <button
            type="button"
            onClick={state.handleBackToList}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-3 hover:text-text-2"
          >
            <AppIcon icon={icons.arrowLeft} size={13} />
            返回列表
          </button>
        ) : (
          <>
            {([
              ['list', '密钥列表', icons.key],
              ['generate', '生成密钥', icons.plus],
              ['import', '导入密钥', icons.clipboardPaste],
            ] as const).map(([key, label, iconId]) => (
              <button
                key={key}
                type="button"
                onClick={() => state.setTab(key)}
                className={`rounded-t-md px-3 py-2 text-xs font-medium transition-colors ${
                  state.tab === key
                    ? 'border-b-2 border-primary bg-primary/5 text-primary'
                    : 'text-text-3 hover:bg-bg-hover hover:text-text-2'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <AppIcon icon={iconId} size={13} />
                  {label}
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="p-4">
        {state.tab === 'list' && (
          <KeyPickerListView
            keys={state.keys}
            loading={state.loading}
            onSelect={onSelect}
            onClose={onClose}
            onEdit={state.handleEdit}
            onRefresh={() => void state.loadKeys()}
          />
        )}
        {state.tab === 'generate' && (
          <KeyPickerGenerateView
            onDone={() => {
              void state.loadKeys()
              state.setTab('list')
            }}
          />
        )}
        {state.tab === 'import' && (
          <KeyPickerImportView
            onDone={() => {
              void state.loadKeys()
              state.setTab('list')
            }}
          />
        )}
        {state.tab === 'edit' && state.editingKey && (
          <KeyPickerEditView
            keyData={state.editingKey}
            onDone={() => {
              void state.loadKeys()
              state.handleBackToList()
            }}
          />
        )}
      </div>
    </IslandModal>
  )
}
