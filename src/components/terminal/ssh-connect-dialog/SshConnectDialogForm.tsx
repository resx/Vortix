import { AppIcon, icons } from '../../icons/AppIcon'
import type { UseSshConnectDialogStateReturn } from './useSshConnectDialogState'
import { SSH_CONNECT_INPUT_CLASS } from './constants'

interface SshConnectDialogFormProps {
  viewModel: UseSshConnectDialogStateReturn
  onClose: () => void
}

export function SshConnectDialogForm({ viewModel, onClose }: SshConnectDialogFormProps) {
  const { state, setField, handleSubmit, handleSave, openAdvancedConfig, isQuickMode, isSaveMode, isEditMode } = viewModel

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      {!isQuickMode && (
        <div>
          <label className="block text-[13px] text-text-2 mb-1">连接名称</label>
          <input
            type="text"
            value={state.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="可选，留空自动使用 host:port"
            className={SSH_CONNECT_INPUT_CLASS}
          />
        </div>
      )}

      {!isQuickMode && (
        <div>
          <label className="block text-[13px] text-text-2 mb-1">所属文件夹</label>
          <div className="relative">
            <AppIcon icon={icons.folderOpen} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
            <select
              value={state.folderId || ''}
              onChange={(e) => setField('folderId', e.target.value || null)}
              className={`${SSH_CONNECT_INPUT_CLASS} pl-9 appearance-none cursor-pointer`}
            >
              <option value="">无（根目录）</option>
              {state.folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-[13px] text-text-2 mb-1">主机地址</label>
          <input
            type="text"
            value={state.host}
            onChange={(e) => setField('host', e.target.value)}
            placeholder="192.168.1.1 或 example.com"
            className={SSH_CONNECT_INPUT_CLASS}
            required
            autoFocus
          />
        </div>
        <div className="w-24">
          <label className="block text-[13px] text-text-2 mb-1">端口</label>
          <input
            type="number"
            value={state.port}
            onChange={(e) => setField('port', e.target.value)}
            className={SSH_CONNECT_INPUT_CLASS}
          />
        </div>
      </div>

      <div>
        <label className="block text-[13px] text-text-2 mb-1">用户名</label>
        <input
          type="text"
          value={state.username}
          onChange={(e) => setField('username', e.target.value)}
          placeholder="root"
          className={SSH_CONNECT_INPUT_CLASS}
          required
        />
      </div>

      <div>
        <label className="block text-[13px] text-text-2 mb-1">认证方式</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setField('authType', 'password')}
            className={`flex-1 py-1.5 rounded text-[13px] font-medium transition-colors ${state.authType === 'password' ? 'bg-primary text-white' : 'bg-bg-base text-text-2 hover:bg-border'}`}
          >
            密码
          </button>
          <button
            type="button"
            onClick={() => setField('authType', 'key')}
            className={`flex-1 py-1.5 rounded text-[13px] font-medium transition-colors ${state.authType === 'key' ? 'bg-primary text-white' : 'bg-bg-base text-text-2 hover:bg-border'}`}
          >
            私钥
          </button>
        </div>
      </div>

      {state.authType === 'password' ? (
        <div>
          <label className="block text-[13px] text-text-2 mb-1">
            密码{isEditMode ? '（留空保持不变）' : ''}
          </label>
          <div className="relative">
            <input
              type={state.showPassword ? 'text' : 'password'}
              value={state.password}
              onChange={(e) => setField('password', e.target.value)}
              placeholder="输入密码"
              className={`${SSH_CONNECT_INPUT_CLASS} pr-10`}
            />
            <button
              type="button"
              onClick={() => setField('showPassword', !state.showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1"
            >
              {state.showPassword ? <AppIcon icon={icons.eyeOff} size={16} /> : <AppIcon icon={icons.eye} size={16} />}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-[13px] text-text-2 mb-1">
            私钥内容{isEditMode ? '（留空保持不变）' : ''}
          </label>
          <textarea
            value={state.privateKey}
            onChange={(e) => setField('privateKey', e.target.value)}
            placeholder="粘贴 PEM 格式私钥"
            rows={4}
            className={`${SSH_CONNECT_INPUT_CLASS} resize-none font-mono text-[12px]`}
          />
        </div>
      )}

      {!isQuickMode && (
        <div>
          <label className="block text-[13px] text-text-2 mb-1">备注</label>
          <input
            type="text"
            value={state.remark}
            onChange={(e) => setField('remark', e.target.value)}
            placeholder="可选"
            className={SSH_CONNECT_INPUT_CLASS}
          />
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={openAdvancedConfig}
          className="px-3 py-2 rounded text-[13px] text-text-2 hover:text-primary hover:bg-primary/5 transition-colors flex items-center gap-1.5"
        >
          <AppIcon icon={icons.settings} size={14} />
          高级配置
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-[13px] text-text-2 bg-bg-base hover:bg-border transition-colors"
          >
            取消
          </button>

          {isQuickMode && (
            <button
              type="submit"
              className="px-4 py-2 rounded text-[13px] text-white bg-primary hover:opacity-90 transition-colors"
            >
              连接
            </button>
          )}

          {isSaveMode && (
            <>
              <button
                type="button"
                onClick={() => void handleSave(false)}
                disabled={state.saving}
                className="px-4 py-2 rounded text-[13px] text-primary border border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => void handleSave(true)}
                disabled={state.saving}
                className="px-4 py-2 rounded text-[13px] text-white bg-primary hover:opacity-90 transition-colors disabled:opacity-50"
              >
                保存并连接
              </button>
            </>
          )}

          {isEditMode && (
            <button
              type="submit"
              disabled={state.saving}
              className="px-4 py-2 rounded text-[13px] text-white bg-primary hover:opacity-90 transition-colors disabled:opacity-50"
            >
              保存
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
