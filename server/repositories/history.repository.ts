/* ── 命令历史 Repository ── */

import { historyStore } from '../db/stores.js'
import type { CommandHistory } from '../types/index.js'

export function findByConnection(connectionId: string, limit = 100): CommandHistory[] {
  return historyStore.find((r) => r.connection_id === connectionId, limit)
}

export function create(connectionId: string, command: string): CommandHistory {
  return historyStore.append({
    connection_id: connectionId,
    command,
    executed_at: new Date().toISOString(),
  } as Omit<CommandHistory, 'id'>)
}

export function removeByConnection(connectionId: string): number {
  return historyStore.removeWhere((r) => r.connection_id === connectionId)
}
