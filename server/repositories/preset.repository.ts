/* ── 连接预设 Repository ── */

import crypto from 'crypto'
import { presetStore } from '../db/stores.js'
import { encrypt, decrypt } from '../services/crypto.service.js'
import { markDirty } from '../services/auto-sync.service.js'
import type { Preset, PresetPublic, PresetCredential, CreatePresetDto, UpdatePresetDto } from '../types/index.js'

function toPublic(row: Preset): PresetPublic {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    remark: row.remark,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function findAll(): PresetPublic[] {
  return presetStore.findAll()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(toPublic)
}

export function findById(id: string): PresetPublic | undefined {
  const row = presetStore.findById(id)
  return row ? toPublic(row) : undefined
}

export function getCredential(id: string): PresetCredential | undefined {
  const row = presetStore.findById(id)
  if (!row) return undefined
  return {
    username: row.username,
    password: decrypt(row.encrypted_password),
  }
}

export function create(dto: CreatePresetDto): PresetPublic {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const row: Preset = {
    id,
    name: dto.name,
    username: dto.username,
    encrypted_password: encrypt(dto.password),
    remark: dto.remark ?? '',
    created_at: now,
    updated_at: now,
  }
  presetStore.insert(row)
  markDirty()
  return toPublic(row)
}

export function update(id: string, dto: UpdatePresetDto): PresetPublic | undefined {
  const result = presetStore.update(id, (existing) => ({
    ...existing,
    name: dto.name ?? existing.name,
    username: dto.username ?? existing.username,
    encrypted_password: dto.password ? encrypt(dto.password) : existing.encrypted_password,
    remark: dto.remark !== undefined ? dto.remark : existing.remark,
    updated_at: new Date().toISOString(),
  }))
  if (result) {
    markDirty()
    return toPublic(result)
  }
  return undefined
}

export function remove(id: string): boolean {
  const ok = presetStore.remove(id)
  if (ok) markDirty()
  return ok
}
