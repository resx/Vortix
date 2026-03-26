import { BasicSettingsLeftSection, BasicSettingsRightSection } from './basic-settings/BasicSettingsSections'

export default function BasicSettings() {
  return (
    <>
      <div className="mb-3 text-[16px] font-medium text-text-1">通用</div>
      <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 min-[900px]:grid-cols-2">
        <BasicSettingsLeftSection />
        <BasicSettingsRightSection />
      </div>
    </>
  )
}
