/* ── 快捷命令 Repository ── */

import crypto from 'crypto'
import { getDb } from '../db/database.js'
import type { Shortcut, CreateShortcutDto, UpdateShortcutDto } from '../types/index.js'

export function findAll(): Shortcut[] {
  const db = getDb()
  return db.prepare('SELECT * FROM shortcuts ORDER BY sort_order, name').all() as Shortcut[]
}

export function findById(id: string): Shortcut | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM shortcuts WHERE id = ?').get(id) as Shortcut | undefined
}

export function create(dto: CreateShortcutDto): Shortcut {
  const db = getDb()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO shortcuts (id, name, command, remark, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, dto.name, dto.command, dto.remark ?? '', dto.sort_order ?? 0, now, now)
  return findById(id)!
}

export function update(id: string, dto: UpdateShortcutDto): Shortcut | undefined {
  const db = getDb()
  const existing = findById(id)
  if (!existing) return undefined

  const name = dto.name ?? existing.name
  const command = dto.command ?? existing.command
  const remark = dto.remark ?? existing.remark
  const sort_order = dto.sort_order ?? existing.sort_order
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE shortcuts SET name = ?, command = ?, remark = ?, sort_order = ?, updated_at = ?
    WHERE id = ?
  `).run(name, command, remark, sort_order, now, id)

  return findById(id)
}

export function remove(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM shortcuts WHERE id = ?').run(id)
  return result.changes > 0
}
