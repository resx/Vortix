import { motion } from 'framer-motion'
import { SettingsPanelChrome } from './settings-panel/SettingsPanelChrome'
import { SettingsPanelFooter } from './settings-panel/SettingsPanelFooter'
import { SettingsPanelSidebar } from './settings-panel/SettingsPanelSidebar'
import { useSettingsPanelState } from './settings-panel/useSettingsPanelState'

export default function SettingsPanel() {
  const {
    constraintRef,
    maximized,
    dragControls,
    panelSize,
    pinned,
    setPinned,
    setMaximized,
    toggleSettings,
    activeNav,
    setActiveNav,
    navData,
    ContentComponent,
    syncTesting,
    syncTestResult,
    handleTestSync,
    resetToDefaults,
    dirty,
    applySettings,
  } = useSettingsPanelState()

  return (
    <motion.div
      ref={constraintRef}
      className="fixed inset-0 z-[301] flex items-center justify-center p-4 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        drag={!maximized}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={constraintRef}
        dragMomentum={false}
        dragElastic={0}
        initial={{ scale: 0.96 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`pointer-events-auto ${panelSize} relative flex flex-col overflow-hidden border border-border/70 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(247,248,250,0.9))] shadow-[0_24px_72px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.65)] transition-all duration-200 dark:bg-[linear-gradient(160deg,rgba(36,37,41,0.96),rgba(28,29,33,0.92))]`}
        onClick={(event) => event.stopPropagation()}
      >
        <SettingsPanelChrome
          pinned={pinned}
          maximized={maximized}
          onTogglePinned={() => setPinned((current) => !current)}
          onToggleMaximized={() => setMaximized((current) => !current)}
          onClose={toggleSettings}
          onMinimize={toggleSettings}
          onDragStart={(event) => {
            if (!(event.target as HTMLElement).closest('button')) dragControls.start(event)
          }}
        />

        <div className="relative z-10 flex flex-1 gap-3 overflow-hidden p-3 pt-2">
          <SettingsPanelSidebar
            activeNav={activeNav}
            setActiveNav={setActiveNav}
            navData={navData}
          />

          <div className="relative flex flex-1 flex-col overflow-hidden rounded-3xl border border-border/70 bg-bg-card/84 shadow-[0_16px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-md">
            <div className="custom-scrollbar flex-1 overflow-y-auto p-7 pb-24">
              {ContentComponent ? (
                <ContentComponent />
              ) : (
                <div className="flex h-full items-center justify-center text-[14px] text-text-3">
                  暂无内容
                </div>
              )}
            </div>

            <SettingsPanelFooter
              activeNav={activeNav}
              syncTesting={syncTesting}
              syncTestResult={syncTestResult}
              handleTestSync={handleTestSync}
              resetToDefaults={resetToDefaults}
              dirty={dirty}
              applySettings={applySettings}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
