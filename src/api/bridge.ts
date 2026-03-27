import { invoke } from '@tauri-apps/api/core'
import type {
  BatchUpdateConnectionDto,
  CreateConnectionDto,
  UpdateConnectionDto,
  Connection,
  ConnectionCredential,
  CreateFolderDto,
  CreateShortcutDto,
  CreateShortcutGroupDto,
  Folder,
  Settings,
  Shortcut,
  ShortcutGroup,
  UpdateShortcutDto,
  UpdateShortcutGroupDto,
  UpdateFolderDto,
} from './types'

interface BridgeHealth {
  status: string
}

export async function bridgeHealth(): Promise<BridgeHealth> {
  return invoke<BridgeHealth>('bridge_health')
}

export async function bridgeGetSettings(): Promise<Settings> {
  return invoke<Settings>('bridge_get_settings')
}

export async function bridgeSaveSettings(settings: Settings): Promise<void> {
  await invoke('bridge_save_settings', { payload: { settings } })
}

export async function bridgeResetSettings(): Promise<void> {
  await invoke('bridge_reset_settings')
}

export async function bridgeListFolders(): Promise<Folder[]> {
  return invoke<Folder[]>('bridge_list_folders')
}

export async function bridgeCreateFolder(dto: CreateFolderDto): Promise<Folder> {
  return invoke<Folder>('bridge_create_folder', { payload: dto })
}

export async function bridgeUpdateFolder(id: string, dto: UpdateFolderDto): Promise<Folder> {
  return invoke<Folder>('bridge_update_folder', { id, payload: dto })
}

export async function bridgeDeleteFolder(id: string): Promise<void> {
  await invoke('bridge_delete_folder', { id })
}

export async function bridgeListShortcuts(): Promise<Shortcut[]> {
  return invoke<Shortcut[]>('bridge_list_shortcuts')
}

export async function bridgeCreateShortcut(dto: CreateShortcutDto): Promise<Shortcut> {
  return invoke<Shortcut>('bridge_create_shortcut', { payload: dto })
}

export async function bridgeUpdateShortcut(id: string, dto: UpdateShortcutDto): Promise<Shortcut> {
  return invoke<Shortcut>('bridge_update_shortcut', { id, payload: dto })
}

export async function bridgeDeleteShortcut(id: string): Promise<void> {
  await invoke('bridge_delete_shortcut', { id })
}

export async function bridgeListShortcutGroups(): Promise<ShortcutGroup[]> {
  return invoke<ShortcutGroup[]>('bridge_list_shortcut_groups')
}

export async function bridgeCreateShortcutGroup(dto: CreateShortcutGroupDto): Promise<ShortcutGroup> {
  return invoke<ShortcutGroup>('bridge_create_shortcut_group', { payload: dto })
}

export async function bridgeUpdateShortcutGroup(id: string, dto: UpdateShortcutGroupDto): Promise<ShortcutGroup> {
  return invoke<ShortcutGroup>('bridge_update_shortcut_group', { id, payload: dto })
}

export async function bridgeDeleteShortcutGroup(id: string): Promise<void> {
  await invoke('bridge_delete_shortcut_group', { id })
}

export async function bridgeListConnections(folderId?: string): Promise<Connection[]> {
  return invoke<Connection[]>('bridge_list_connections', {
    query: folderId ? { folder_id: folderId } : null,
  })
}

export async function bridgeGetConnection(id: string): Promise<Connection> {
  return invoke<Connection>('bridge_get_connection', { id })
}

export async function bridgeGetConnectionCredential(id: string): Promise<ConnectionCredential> {
  return invoke<ConnectionCredential>('bridge_get_connection_credential', { id })
}

export async function bridgeCreateConnection(dto: CreateConnectionDto): Promise<Connection> {
  return invoke<Connection>('bridge_create_connection', { payload: dto })
}

export async function bridgeUpdateConnection(id: string, dto: UpdateConnectionDto): Promise<Connection> {
  return invoke<Connection>('bridge_update_connection', { id, payload: dto })
}

export async function bridgeDeleteConnection(id: string): Promise<void> {
  await invoke('bridge_delete_connection', { id })
}

export async function bridgeBatchUpdateConnections(dto: BatchUpdateConnectionDto): Promise<Connection[]> {
  return invoke<Connection[]>('bridge_batch_update_connections', { payload: dto })
}

export async function bridgePingConnections(ids: string[]): Promise<Record<string, number | null>> {
  return invoke<Record<string, number | null>>('bridge_ping_connections', { ids })
}
