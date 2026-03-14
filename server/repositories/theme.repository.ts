/* ── 自定义主题 Repository ── */

import crypto from 'crypto'
import { themeStore } from '../db/stores.js'
import { markDirty } from '../services/auto-sync.service.js'
import type { CustomTheme, CreateCustomThemeDto, UpdateCustomThemeDto } from '../types/index.js'

export function findAll(): CustomTheme[] {
  return themeStore.findAll()
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function findById(id: string): CustomTheme | undefined {
  return themeStore.findById(id)
}

export function create(dto: CreateCustomThemeDto): CustomTheme {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const row: CustomTheme = {
    id,
    name: dto.name,
    mode: dto.mode,
    version: 1,
    author: dto.author ?? '',
    terminal: dto.terminal,
    highlights: dto.highlights,
    ui: dto.ui,
    created_at: now,
    updated_at: now,
  }
  themeStore.insert(row)
  markDirty()
  return row
}

export function update(id: string, dto: UpdateCustomThemeDto): CustomTheme | undefined {
  const result = themeStore.update(id, (existing) => ({
    ...existing,
    name: dto.name ?? existing.name,
    mode: dto.mode ?? existing.mode,
    terminal: dto.terminal ?? existing.terminal,
    highlights: dto.highlights ?? existing.highlights,
    ui: dto.ui !== undefined ? dto.ui : existing.ui,
    updated_at: new Date().toISOString(),
  }))
  if (result) {
    markDirty()
    return result
  }
  return undefined
}

export function remove(id: string): boolean {
  const ok = themeStore.remove(id)
  if (ok) markDirty()
  return ok
}
