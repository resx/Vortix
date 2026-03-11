import { useEffect } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { useUIStore } from '../../stores/useUIStore'
import { useSshConfigStore } from '../../stores/useSshConfigStore'
import type { SshConfigTab } from '../../stores/useSshConfigStore'
import StandardTab from './tabs/StandardTab'
import TunnelTab from './tabs/TunnelTab'
import ProxyTab from './tabs/ProxyTab'
import EnvVarsTab from './tabs/EnvVarsTab'
import AdvancedTab from './tabs/AdvancedTab'
import SelectKeyModal from './modals/SelectKeyModal'
import ImportKeyModal from './modals/ImportKeyModal'
import SelectPresetModal from './modals/SelectPresetModal'
import ManagePresetModal from './modals/ManagePresetModal'
import SelectAssetModal from './modals/SelectAssetModal'

const TABS: SshConfigTab[] = ['标准', '隧道', '代理', '环境变量', '高级']

export default function SshConfigDialog() {
  const closeSshConfig = useUIStore((s) => s.closeSshConfig)
  const sshConfigMode = useUIStore((s) => s.sshConfigMode)
  const sshConfigInitialId = useUIStore((s) => s.sshConfigInitialId)
  const sshConfigFromQuickConnect = useUIStore((s) => s.sshConfigFromQuickConnect)
  const activeTab = useSshConfigStore((s) => s.activeTab)
  const setActiveTab = useSshConfigStore((s) => s.setActiveTab)
  const subModals = useSshConfigStore((s) => s.subModals)
  const saving = useSshConfigStore((s) => s.saving)
  const loading = useSshConfigStore((s) => s.loading)
  const testing = useSshConfigStore((s) => s.testing)
  const testResult = useSshConfigStore((s) => s.testResult)
  const testConnection = useSshConfigStore((s) => s.testConnection)
  const save = useSshConfigStore((s) => s.save)
  const reset = useSshConfigStore((s) => s.reset)
  const loadFromConnection = useSshConfigStore((s) => s.loadFromConnection)

  // mount 时加载编辑数据 / unmount 时重置
  // fromQuickConnect 时数据已由 prefillFromQuickConnect 预填充，跳过 API 加载
  useEffect(() => {
    if (!sshConfigFromQuickConnect && sshConfigMode === 'edit' && sshConfigInitialId) {
      loadFromConnection(sshConfigInitialId)
    }
    return () => { reset() }
  }, [sshConfigMode, sshConfigInitialId, sshConfigFromQuickConnect, loadFromConnection, reset])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
      <div className="relative bg-bg-base rounded-xl shadow-xl border border-border/60 w-[700px] h-[580px] flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* 外层头部 */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <h2 className="text-[14px] font-bold text-text-1 tracking-wide">SSH 配置编辑</h2>
          <button
            onClick={closeSshConfig}
            className="p-1.5 hover:bg-bg-hover rounded-md text-text-3 transition-colors"
          >
            <AppIcon icon={icons.close} size={18} />
          </button>
        </div>

        {/* 白色岛屿内容区 */}
        <div className="flex-1 flex flex-col mx-4 bg-bg-card rounded-xl border border-border/80 shadow-sm overflow-hidden min-h-0">

          {/* Tab 栏 */}
          <div className="flex justify-center mt-4 mb-3 shrink-0">
            <div className="bg-bg-base/80 p-0.5 rounded-lg inline-flex space-x-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-xs rounded-md transition-all ${
                    activeTab === tab
                      ? 'bg-bg-card shadow-sm text-text-1 font-medium'
                      : 'text-text-3 hover:text-text-2'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* 表单内容滚动区 */}
          <div className="flex-1 overflow-y-auto px-7 py-2 custom-scrollbar">
            {activeTab === '标准' && <StandardTab />}
            {activeTab === '隧道' && <TunnelTab />}
            {activeTab === '代理' && <ProxyTab />}
            {activeTab === '环境变量' && <EnvVarsTab />}
            {activeTab === '高级' && <AdvancedTab />}
          </div>
        </div>

        {/* 外层底部按钮 */}
        <div className="px-6 py-4 flex justify-between items-center shrink-0">
          <button
            className={`text-xs font-medium transition-colors ${
              testResult
                ? testResult.success
                  ? 'text-green-500'
                  : 'text-red-500'
                : 'text-primary hover:opacity-80'
            }`}
            onClick={testConnection}
            disabled={saving || loading || testing}
          >
            {testing ? '测试中...' : testResult ? (testResult.success ? `✓ ${testResult.message}` : `✗ ${testResult.message}`) : '测试连接'}
          </button>
          <button
            className={`text-xs font-medium transition-colors ${saving || loading ? 'text-text-disabled cursor-not-allowed' : 'text-primary hover:opacity-80'}`}
            onClick={save}
            disabled={saving || loading}
          >
            {saving ? '保存中...' : loading ? '加载中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 子弹窗 */}
      {subModals.selectKey && <SelectKeyModal />}
      {subModals.importKey && <ImportKeyModal />}
      {subModals.selectPreset && <SelectPresetModal />}
      {subModals.managePreset && <ManagePresetModal />}
      {subModals.selectAsset && <SelectAssetModal />}
    </div>
  )
}
