/* ── SFTP 文件浏览状态（双会话） ── */

import { create } from 'zustand'
import {
  MAX_HISTORY,
  createInitialSftpState,
  createSessionState,
  mirrorActiveSession,
  pickSessionId,
  updateSession,
  type SftpState,
} from './sftp-store-core'

export type { SftpSessionId } from './sftp-store-core'

export const useSftpStore = create<SftpState>((set, get) => ({
  ...createInitialSftpState(),

  setActiveSession: (sessionId) => set((state) => {
    if (state.activeSessionId === sessionId) return {}
    const next = { ...state, activeSessionId: sessionId } as SftpState
    return { activeSessionId: sessionId, ...mirrorActiveSession(next) }
  }),

  getSessionState: (sessionId) => {
    const state = get()
    return state.sessions[pickSessionId(state, sessionId)]
  },

  setConnected: (connected, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, connected }))
  }),
  setConnecting: (connecting, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, connecting }))
  }),
  setError: (error, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, error }))
  }),
  setConnectionInfo: (id, name, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, connectionId: id, connectionName: name }))
  }),
  setBridgeSessionKey: (key, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, bridgeSessionKey: key }))
  }),
  setReconnectState: ({ reconnecting, reconnectAttempt, reconnectMax, reconnectMessage }, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({
      ...session,
      reconnecting,
      reconnectAttempt: reconnectAttempt ?? session.reconnectAttempt,
      reconnectMax: reconnectMax ?? session.reconnectMax,
      reconnectMessage: reconnectMessage ?? null,
    }))
  }),
  setHomePath: (home, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, homePath: home }))
  }),

  navigateTo: (path, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    const session = state.sessions[sid]
    if (path === session.currentPath) return {}
    const baseHistory = session.pathHistory.slice(0, session.historyIndex + 1)
    const nextHistory = baseHistory[baseHistory.length - 1] === path
      ? baseHistory
      : [...baseHistory, path]
    let nextIndex = nextHistory.length - 1
    if (nextHistory.length > MAX_HISTORY) {
      const overflow = nextHistory.length - MAX_HISTORY
      nextHistory.splice(0, overflow)
      nextIndex = Math.max(0, nextIndex - overflow)
    }
    return updateSession(state, sid, () => ({
      ...session,
      currentPath: path,
      pathHistory: nextHistory,
      historyIndex: nextIndex,
      selectedPaths: new Set<string>(),
    }))
  }),

  goBack: (sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    const session = state.sessions[sid]
    if (session.historyIndex <= 0) return {}
    const newIndex = session.historyIndex - 1
    return updateSession(state, sid, () => ({
      ...session,
      currentPath: session.pathHistory[newIndex],
      historyIndex: newIndex,
      selectedPaths: new Set<string>(),
    }))
  }),

  goForward: (sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    const session = state.sessions[sid]
    if (session.historyIndex >= session.pathHistory.length - 1) return {}
    const newIndex = session.historyIndex + 1
    return updateSession(state, sid, () => ({
      ...session,
      currentPath: session.pathHistory[newIndex],
      historyIndex: newIndex,
      selectedPaths: new Set<string>(),
    }))
  }),

  goHome: (sessionId) => {
    const state = get()
    const sid = pickSessionId(state, sessionId)
    const session = state.sessions[sid]
    get().navigateTo(session.homePath, sid)
  },

  goUp: (sessionId) => {
    const state = get()
    const sid = pickSessionId(state, sessionId)
    const session = state.sessions[sid]
    if (session.currentPath === '/') return
    const parent = session.currentPath.replace(/\/[^/]+\/?$/, '') || '/'
    get().navigateTo(parent, sid)
  },

  setEntries: (entries, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, entries }))
  }),
  setLoading: (loading, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, loading }))
  }),

  setSortField: (field, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, sortField: field }))
  }),
  setSortOrder: (order, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, sortOrder: order }))
  }),

  toggleSort: (field, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    const session = state.sessions[sid]
    return updateSession(state, sid, () => ({
      ...session,
      sortField: field,
      sortOrder: session.sortField === field
        ? (session.sortOrder === 'asc' ? 'desc' : 'asc')
        : 'asc',
    }))
  }),

  selectPath: (path, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, selectedPaths: new Set([path]) }))
  }),
  toggleSelect: (path, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    const session = state.sessions[sid]
    const next = new Set(session.selectedPaths)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    return updateSession(state, sid, () => ({ ...session, selectedPaths: next }))
  }),
  selectRange: (paths, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, selectedPaths: new Set(paths) }))
  }),
  selectAll: (sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    const session = state.sessions[sid]
    const all = session.entries.map(e => e.path)
    return updateSession(state, sid, () => ({ ...session, selectedPaths: new Set(all) }))
  }),
  clearSelection: (sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, selectedPaths: new Set() }))
  }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setShowHidden: (show) => set({ showHidden: show }),
  setSearchQuery: (query, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, searchQuery: query }))
  }),
  setSearchActive: (active, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => active
      ? { ...session, searchActive: true }
      : { ...session, searchActive: false, searchQuery: '' })
  }),
  setPathSyncEnabled: (enabled) => set({ pathSyncEnabled: enabled }),
  setRenamingPath: (path, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({ ...session, renamingPath: path }))
  }),

  removeHistoryPath: (path, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    const session = state.sessions[sid]
    if (path === session.currentPath) return {}
    const nextHistory = session.pathHistory.filter(p => p !== path)
    if (nextHistory.length === 0) {
      return updateSession(state, sid, () => ({ ...session, pathHistory: [session.currentPath], historyIndex: 0 }))
    }
    const removedBefore = session.pathHistory.slice(0, session.historyIndex).filter(p => p === path).length
    const nextIndex = Math.min(nextHistory.length - 1, Math.max(0, session.historyIndex - removedBefore))
    return updateSession(state, sid, () => ({ ...session, pathHistory: nextHistory, historyIndex: nextIndex }))
  }),

  clearHistory: (sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    const session = state.sessions[sid]
    return updateSession(state, sid, () => ({ ...session, pathHistory: [session.currentPath], historyIndex: 0 }))
  }),

  updateEntrySize: (path, size, sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, (session) => ({
      ...session,
      entries: session.entries.map(e => (e.path === path ? { ...e, size } : e)),
    }))
  }),

  reset: (sessionId) => set((state) => {
    const sid = pickSessionId(state, sessionId)
    return updateSession(state, sid, () => createSessionState())
  }),
}))
