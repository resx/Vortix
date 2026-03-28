import type {
  CreateShortcutDto,
  CreateShortcutGroupDto,
  Settings,
  Shortcut,
  ShortcutGroup,
  UpdateShortcutDto,
  UpdateShortcutGroupDto,
} from '../types'
import { request } from '../http'
import {
  bridgeCreateShortcut,
  bridgeCreateShortcutGroup,
  bridgeDeleteShortcut,
  bridgeDeleteShortcutGroup,
  bridgeGetSettings,
  bridgeListShortcutGroups,
  bridgeListShortcuts,
  bridgeResetSettings,
  bridgeSaveSettings,
  bridgeUpdateShortcut,
  bridgeUpdateShortcutGroup,
} from '../bridge'

export async function getSettings(): Promise<Settings> {
  try {
    return await bridgeGetSettings()
  } catch {
    return request<Settings>('/settings')
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await bridgeSaveSettings(settings)
  } catch {
    await request<void>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  }
}

export async function resetSettings(): Promise<void> {
  try {
    await bridgeResetSettings()
  } catch {
    await request<void>('/settings/reset', { method: 'POST' })
  }
}

export async function getShortcuts(): Promise<Shortcut[]> {
  try {
    return await bridgeListShortcuts()
  } catch {
    return request<Shortcut[]>('/shortcuts')
  }
}

export async function createShortcut(dto: CreateShortcutDto): Promise<Shortcut> {
  try {
    return await bridgeCreateShortcut(dto)
  } catch {
    return request<Shortcut>('/shortcuts', {
      method: 'POST',
      body: JSON.stringify(dto),
    })
  }
}

export async function updateShortcut(id: string, dto: UpdateShortcutDto): Promise<Shortcut> {
  try {
    return await bridgeUpdateShortcut(id, dto)
  } catch {
    return request<Shortcut>(`/shortcuts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    })
  }
}

export async function deleteShortcut(id: string): Promise<void> {
  try {
    await bridgeDeleteShortcut(id)
  } catch {
    await request<void>(`/shortcuts/${id}`, { method: 'DELETE' })
  }
}

export async function getShortcutGroups(): Promise<ShortcutGroup[]> {
  try {
    return await bridgeListShortcutGroups()
  } catch {
    return request<ShortcutGroup[]>('/shortcut-groups')
  }
}

export async function createShortcutGroup(dto: CreateShortcutGroupDto): Promise<ShortcutGroup> {
  try {
    return await bridgeCreateShortcutGroup(dto)
  } catch {
    return request<ShortcutGroup>('/shortcut-groups', {
      method: 'POST',
      body: JSON.stringify(dto),
    })
  }
}

export async function updateShortcutGroup(id: string, dto: UpdateShortcutGroupDto): Promise<ShortcutGroup> {
  try {
    return await bridgeUpdateShortcutGroup(id, dto)
  } catch {
    return request<ShortcutGroup>(`/shortcut-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    })
  }
}

export async function deleteShortcutGroup(id: string): Promise<void> {
  try {
    await bridgeDeleteShortcutGroup(id)
  } catch {
    await request<void>(`/shortcut-groups/${id}`, { method: 'DELETE' })
  }
}
