/* ── 新建连接子菜单（共享组件） ── */
/* 从连接类型注册表动态生成菜单项 */

import { getConnectionTypes } from '../../../registries/connection-type.registry'
import { AppIcon } from '../../../components/icons/AppIcon'
import { ProtocolIcon } from '../../../components/icons/ProtocolIcons'
import { MenuItem } from './MenuParts'

interface NewConnectionSubmenuProps {
  onClose: () => void
}

export function NewConnectionSubmenu({ onClose }: NewConnectionSubmenuProps) {
  const types = getConnectionTypes()

  return (
    <>
      {types.map((t) => (
        <MenuItem
          key={t.protocol}
          iconNode={
            t.useProtocolIcon
              ? <ProtocolIcon protocol={t.protocol} size={12} mono className="text-text-1" />
              : t.icon
                ? <AppIcon icon={t.icon} size={12} className="text-text-1" />
                : undefined
          }
          label={t.label}
          disabled={!t.implemented}
          onClick={t.implemented && t.openConfig ? () => { onClose(); t.openConfig!('create') } : undefined}
        />
      ))}
    </>
  )
}
