/* ── 文件夹 Repository ── */

import crypto from 'crypto'
import { getDb } from '../db/database.js'
import type { Folder, CreateFolderDto, UpdateFolderDto } from '../types/index.js'

export function findAll(): Folder[] {
  const db = getDb()
  return db.prepare('SELECT * FROM folders ORDER BY sort_order, name').all() as Folder[]
}

export function findById(id: string): Folder | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Folder | undefined
}

export function create(dto: CreateFolderDto): Folder {
  const db = getDb()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO folders (id, name, parent_id, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, dto.name, dto.parent_id ?? null, dto.sort_order ?? 0, now, now)
  return findById(id)!
}

export function update(id: string, dto: UpdateFolderDto): Folder | undefined {
  const db = getDb()
  const existing = findById(id)
  if (!existing) return undefined

  const name = dto.name ?? existing.name
  const parent_id = dto.parent_id !== undefined ? dto.parent_id : existing.parent_id
  const sort_order = dto.sort_order ?? existing.sort_order
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE folders SET name = ?, parent_id = ?, sort_order = ?, updated_at = ?
    WHERE id = ?
  `).run(name, parent_id, sort_order, now, id)

  return findById(id)
}

export function remove(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM folders WHERE id = ?').run(id)
  return result.changes > 0
}
