/* ── 文件夹 Repository ── */

import crypto from 'crypto'
import { folderStore } from '../db/stores.js'
import { markDirty } from '../services/auto-sync.service.js'
import type { Folder, CreateFolderDto, UpdateFolderDto } from '../types/index.js'

export function findAll(): Folder[] {
  return folderStore.findAll().sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function findById(id: string): Folder | undefined {
  return folderStore.findById(id)
}

export function create(dto: CreateFolderDto): Folder {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const folder: Folder = {
    id, name: dto.name, parent_id: dto.parent_id ?? null,
    sort_order: dto.sort_order ?? 0, created_at: now, updated_at: now,
  }
  folderStore.insert(folder)
  markDirty()
  return folder
}

export function update(id: string, dto: UpdateFolderDto): Folder | undefined {
  const result = folderStore.update(id, (existing) => ({
    ...existing,
    name: dto.name ?? existing.name,
    parent_id: dto.parent_id !== undefined ? dto.parent_id : existing.parent_id,
    sort_order: dto.sort_order ?? existing.sort_order,
    updated_at: new Date().toISOString(),
  }))
  if (result) markDirty()
  return result
}

export function remove(id: string): boolean {
  const ok = folderStore.remove(id)
  if (ok) markDirty()
  return ok
}
