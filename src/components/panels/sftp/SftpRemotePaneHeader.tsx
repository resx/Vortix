import { useMemo } from 'react'
import { icons } from '../../icons/AppIcon'
import { useSftpStore } from '../../../stores/useSftpStore'
import SftpPaneHeader from './SftpPaneHeader'
import type { SftpSessionId } from '../../../stores/useSftpStore'

interface Props {
  sessionId?: SftpSessionId
  title: string
  active?: boolean
  onNavigate: (path: string) => void
  onRefresh: () => void
  onListDir: (path: string) => void
  onTitleClick?: () => void
}

function getParentPath(path: string): string {
  if (!path || path === '/') return '/'
  return path.replace(/\/[^/]+\/?$/, '') || '/'
}

export default function SftpRemotePaneHeader({ sessionId = 'right', title, active = false, onNavigate, onRefresh, onListDir, onTitleClick }: Props) {
  const currentPath = useSftpStore((s) => s.sessions[sessionId].currentPath)
  const historyIndex = useSftpStore((s) => s.sessions[sessionId].historyIndex)
  const pathHistory = useSftpStore((s) => s.sessions[sessionId].pathHistory)
  const goBack = useSftpStore((s) => s.goBack)
  const goForward = useSftpStore((s) => s.goForward)
  const searchActive = useSftpStore((s) => s.sessions[sessionId].searchActive)
  const searchQuery = useSftpStore((s) => s.sessions[sessionId].searchQuery)
  const setSearchActive = useSftpStore((s) => s.setSearchActive)
  const setSearchQuery = useSftpStore((s) => s.setSearchQuery)
  const canGoBack = historyIndex > 0
  const canGoForward = historyIndex < pathHistory.length - 1
  const canGoUp = currentPath !== '/'
  const pathActions = useMemo(() => ([
    {
      key: 'back',
      title: '后退',
      icon: icons.chevronLeft,
      disabled: !canGoBack,
      onClick: () => {
        if (!canGoBack) return
        const target = pathHistory[historyIndex - 1]
        goBack(sessionId)
        onListDir(target)
      },
    },
    {
      key: 'forward',
      title: '前进',
      icon: icons.chevronRight,
      disabled: !canGoForward,
      onClick: () => {
        if (!canGoForward) return
        const target = pathHistory[historyIndex + 1]
        goForward(sessionId)
        onListDir(target)
      },
    },
    {
      key: 'up',
      title: '返回上一级',
      icon: icons.chevronUp,
      disabled: !canGoUp,
      onClick: () => onNavigate(getParentPath(currentPath)),
    },
    {
      key: 'refresh',
      title: '刷新',
      icon: icons.refresh,
      onClick: onRefresh,
    },
  ]), [canGoBack, canGoForward, canGoUp, currentPath, goBack, goForward, historyIndex, onListDir, onNavigate, onRefresh, pathHistory, sessionId])

  return (
    <SftpPaneHeader
      title={title}
      path={currentPath}
      active={active}
      onTitleClick={onTitleClick}
      pathActions={pathActions}
      searchEnabled
      searchExpanded={searchActive}
      searchValue={searchQuery}
      onSearchToggle={() => setSearchActive(true, sessionId)}
      onSearchChange={(value) => {
        setSearchQuery(value, sessionId)
        if (!searchActive) setSearchActive(true, sessionId)
      }}
      onSearchClear={() => setSearchActive(false, sessionId)}
      onPathSubmit={(next) => onNavigate(next.startsWith('/') ? next : `/${next}`)}
    />
  )
}
