import type { SftpFileEntry, SftpSortField, SftpSortOrder } from '../types/sftp'

export type SftpSessionId = 'left' | 'right'

export interface SftpSessionState {
  bridgeSessionKey: string
  connected: boolean
  connecting: boolean
  error: string | null
  connectionId: string
  connectionName: string
  reconnecting: boolean
  reconnectAttempt: number
  reconnectMax: number
  reconnectMessage: string | null
  currentPath: string
  homePath: string
  pathHistory: string[]
  historyIndex: number
  entries: SftpFileEntry[]
  loading: boolean
  sortField: SftpSortField
  sortOrder: SftpSortOrder
  selectedPaths: Set<string>
  searchQuery: string
  searchActive: boolean
  renamingPath: string | null
}

export interface SftpState {
  sessions: Record<SftpSessionId, SftpSessionState>
  activeSessionId: SftpSessionId
  viewMode: 'list' | 'grid'
  showHidden: boolean
  pathSyncEnabled: boolean
  bridgeSessionKey: string
  connected: boolean
  connecting: boolean
  error: string | null
  connectionId: string
  connectionName: string
  reconnecting: boolean
  reconnectAttempt: number
  reconnectMax: number
  reconnectMessage: string | null
  currentPath: string
  homePath: string
  pathHistory: string[]
  historyIndex: number
  entries: SftpFileEntry[]
  loading: boolean
  sortField: SftpSortField
  sortOrder: SftpSortOrder
  selectedPaths: Set<string>
  searchQuery: string
  searchActive: boolean
  renamingPath: string | null
  setActiveSession: (sessionId: SftpSessionId) => void
  getSessionState: (sessionId?: SftpSessionId) => SftpSessionState
  setConnected: (connected: boolean, sessionId?: SftpSessionId) => void
  setConnecting: (connecting: boolean, sessionId?: SftpSessionId) => void
  setError: (error: string | null, sessionId?: SftpSessionId) => void
  setConnectionInfo: (id: string, name: string, sessionId?: SftpSessionId) => void
  setBridgeSessionKey: (key: string, sessionId?: SftpSessionId) => void
  setReconnectState: (payload: {
    reconnecting: boolean
    reconnectAttempt?: number
    reconnectMax?: number
    reconnectMessage?: string | null
  }, sessionId?: SftpSessionId) => void
  setHomePath: (home: string, sessionId?: SftpSessionId) => void
  navigateTo: (path: string, sessionId?: SftpSessionId) => void
  goBack: (sessionId?: SftpSessionId) => void
  goForward: (sessionId?: SftpSessionId) => void
  goHome: (sessionId?: SftpSessionId) => void
  goUp: (sessionId?: SftpSessionId) => void
  setEntries: (entries: SftpFileEntry[], sessionId?: SftpSessionId) => void
  setLoading: (loading: boolean, sessionId?: SftpSessionId) => void
  setSortField: (field: SftpSortField, sessionId?: SftpSessionId) => void
  setSortOrder: (order: SftpSortOrder, sessionId?: SftpSessionId) => void
  toggleSort: (field: SftpSortField, sessionId?: SftpSessionId) => void
  selectPath: (path: string, sessionId?: SftpSessionId) => void
  toggleSelect: (path: string, sessionId?: SftpSessionId) => void
  selectRange: (paths: string[], sessionId?: SftpSessionId) => void
  selectAll: (sessionId?: SftpSessionId) => void
  clearSelection: (sessionId?: SftpSessionId) => void
  setViewMode: (mode: 'list' | 'grid') => void
  setShowHidden: (show: boolean) => void
  setSearchQuery: (query: string, sessionId?: SftpSessionId) => void
  setSearchActive: (active: boolean, sessionId?: SftpSessionId) => void
  setPathSyncEnabled: (enabled: boolean) => void
  setRenamingPath: (path: string | null, sessionId?: SftpSessionId) => void
  removeHistoryPath: (path: string, sessionId?: SftpSessionId) => void
  clearHistory: (sessionId?: SftpSessionId) => void
  updateEntrySize: (path: string, size: number, sessionId?: SftpSessionId) => void
  reset: (sessionId?: SftpSessionId) => void
}

export const MAX_HISTORY = 200

export const createSessionState = (): SftpSessionState => ({
  bridgeSessionKey: '',
  connected: false,
  connecting: false,
  error: null,
  connectionId: '',
  connectionName: '',
  reconnecting: false,
  reconnectAttempt: 0,
  reconnectMax: 0,
  reconnectMessage: null,
  currentPath: '/',
  homePath: '/',
  pathHistory: ['/'],
  historyIndex: 0,
  entries: [],
  loading: false,
  sortField: 'name',
  sortOrder: 'asc',
  selectedPaths: new Set<string>(),
  searchQuery: '',
  searchActive: false,
  renamingPath: null,
})

export const createInitialSftpState = (): Pick<
  SftpState,
  | 'sessions'
  | 'activeSessionId'
  | 'viewMode'
  | 'showHidden'
  | 'pathSyncEnabled'
  | 'bridgeSessionKey'
  | 'connected'
  | 'connecting'
  | 'error'
  | 'connectionId'
  | 'connectionName'
  | 'reconnecting'
  | 'reconnectAttempt'
  | 'reconnectMax'
  | 'reconnectMessage'
  | 'currentPath'
  | 'homePath'
  | 'pathHistory'
  | 'historyIndex'
  | 'entries'
  | 'loading'
  | 'sortField'
  | 'sortOrder'
  | 'selectedPaths'
  | 'searchQuery'
  | 'searchActive'
  | 'renamingPath'
> => ({
  sessions: { left: createSessionState(), right: createSessionState() },
  activeSessionId: 'right',
  viewMode: 'list',
  showHidden: false,
  pathSyncEnabled: false,
  bridgeSessionKey: '',
  connected: false,
  connecting: false,
  error: null,
  connectionId: '',
  connectionName: '',
  reconnecting: false,
  reconnectAttempt: 0,
  reconnectMax: 0,
  reconnectMessage: null,
  currentPath: '/',
  homePath: '/',
  pathHistory: ['/'],
  historyIndex: 0,
  entries: [],
  loading: false,
  sortField: 'name',
  sortOrder: 'asc',
  selectedPaths: new Set<string>(),
  searchQuery: '',
  searchActive: false,
  renamingPath: null,
})

export function pickSessionId(state: SftpState, sessionId?: SftpSessionId): SftpSessionId {
  return sessionId ?? state.activeSessionId
}

export function mirrorActiveSession(state: SftpState): Partial<SftpState> {
  const active = state.sessions[state.activeSessionId]
  return {
    bridgeSessionKey: active.bridgeSessionKey,
    connected: active.connected,
    connecting: active.connecting,
    error: active.error,
    connectionId: active.connectionId,
    connectionName: active.connectionName,
    reconnecting: active.reconnecting,
    reconnectAttempt: active.reconnectAttempt,
    reconnectMax: active.reconnectMax,
    reconnectMessage: active.reconnectMessage,
    currentPath: active.currentPath,
    homePath: active.homePath,
    pathHistory: active.pathHistory,
    historyIndex: active.historyIndex,
    entries: active.entries,
    loading: active.loading,
    sortField: active.sortField,
    sortOrder: active.sortOrder,
    selectedPaths: active.selectedPaths,
    searchQuery: active.searchQuery,
    searchActive: active.searchActive,
    renamingPath: active.renamingPath,
  }
}

export function updateSession(
  state: SftpState,
  sessionId: SftpSessionId,
  updater: (session: SftpSessionState) => SftpSessionState,
): Partial<SftpState> {
  const nextSessions = {
    ...state.sessions,
    [sessionId]: updater(state.sessions[sessionId]),
  }
  const draft = { ...state, sessions: nextSessions } as SftpState
  return { sessions: nextSessions, ...mirrorActiveSession(draft) }
}
