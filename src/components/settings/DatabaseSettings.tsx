import { SettingGroup } from './SettingGroup'
import { SToggle, SDropdown, SFontSelect, SNumberInput, STextInput } from './SettingControls'

/* ── 数据库设置 ── */
export default function DatabaseSettings() {
  return (
    <div className="relative">
      {/* 即将推出横幅 */}
      <div className="mb-6 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20 text-[13px] text-primary flex items-center gap-2">
        <span className="text-[16px]">🚧</span>
        <span>数据库功能正在开发中，以下设置项将在功能上线后生效。</span>
      </div>

      {/* 禁用遮罩 */}
      <div className="opacity-50 pointer-events-none">
        {/* 数据库区域 */}
        <div className="text-[16px] font-medium text-text-1 mb-3">数据库</div>
        <div className="grid grid-cols-1 min-[900px]:grid-cols-2 gap-x-6 gap-y-4 mb-6 items-start">
          <SettingGroup>
            <SFontSelect k="dbTableFont" label="表格字体" />
            <SToggle k="dbAutoExpand" label="打开连接时自动展开" />
            <SToggle k="dbShowPrimaryKey" label="固定显示表格主键列" />
            <SToggle k="dbCalcTotalRows" label="计算表数据总行数" desc="开启后将自动获取总行数/总页数" />
            <SToggle k="dbCompositeHeader" label="复合数据表头" desc="开启后将在数据表头固定显示类型+注释" />
            <SToggle k="dbLoadAllFields" label="加载所有库字段信息" desc="开启后SQL编辑器能够跨数据库提示" />
          </SettingGroup>
          <SettingGroup>
            <SDropdown
              k="dbTextAlign" label="表格文本对齐方式"
              options={[
                { value: 'auto', label: '自动' },
                { value: 'center', label: '居中' },
                { value: 'left', label: '居左' },
                { value: 'right', label: '居右' },
              ]}
            />
            <SNumberInput k="dbRowsPerPage" label="表格每页显示行数" width="w-[60px]" />
            <SToggle k="dbDangerSqlConfirm" label="危险SQL执行二次确认" />
            <SToggle k="dbSqlStopOnError" label="SQL编辑器执行失败时停止" />
            <SDropdown
              k="dbScrollMode" label="表格滚动方式"
              options={[
                { value: 'natural', label: '自然滚动' },
                { value: 'cursor', label: '游标滚动' },
              ]}
              width="w-[120px]"
            />
            <SNumberInput k="dbCursorScrollSpeed" label="表格游标滚动速度" width="w-[40px]" />
          </SettingGroup>
        </div>

        {/* Redis 区域 */}
        <div className="text-[16px] font-medium text-text-1 mb-3">Redis</div>
        <div className="grid grid-cols-1 min-[900px]:grid-cols-2 gap-x-6 gap-y-4 items-start">
          <SettingGroup>
            <SNumberInput k="redisMaxLoadCount" label="键列表-最大加载数据量" width="w-[80px]" />
            <SToggle k="redisShowValue" label="键列表-显示值" desc="低带宽环境,关闭值加载后可有效提升加载速度" />
          </SettingGroup>
          <SettingGroup>
            <STextInput k="redisGroupSeparator" label="键列表-分组分隔符" width="w-[40px]" />
          </SettingGroup>
        </div>
      </div>
    </div>
  )
}
