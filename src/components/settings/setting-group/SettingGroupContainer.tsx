import { type ReactNode } from 'react'

export function SettingGroup({ children }: { children: ReactNode }) {
  return (
    <div className="island-surface self-start flex flex-col p-1 min-w-0 max-w-full overflow-hidden">
      {children}
    </div>
  )
}
