/* ── 快捷命令 Repository ── */

import crypto from 'crypto'
import { shortcutStore } from '../db/stores.js'
import { markDirty } from '../services/auto-sync.service.js'
import type { Shortcut, CreateShortcutDto, UpdateShortcutDto } from '../types/index.js'

export function findAll(): Shortcut[] {
  return shortcutStore.findAll().sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
}

export function findById(id: string): Shortcut | undefined {
  return shortcutStore.findById(id)
}

export function create(dto: CreateShortcutDto): Shortcut {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const shortcut: Shortcut = {
    id, name: dto.name, command: dto.command,
    remark: dto.remark ?? '', sort_order: dto.sort_order ?? 0,
    created_at: now, updated_at: now,
  }
  shortcutStore.insert(shortcut)
  markDirty()
  return shortcut
}

export function update(id: string, dto: UpdateShortcutDto): Shortcut | undefined {
  const result = shortcutStore.update(id, (existing) => ({
    ...existing,
    name: dto.name ?? existing.name,
    command: dto.command ?? existing.command,
    remark: dto.remark ?? existing.remark,
    sort_order: dto.sort_order ?? existing.sort_order,
    updated_at: new Date().toISOString(),
  }))
  if (result) markDirty()
  return result
}

export function remove(id: string): boolean {
  const ok = shortcutStore.remove(id)
  if (ok) markDirty()
  return ok
}
