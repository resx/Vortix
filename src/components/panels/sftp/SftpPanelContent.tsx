import { useMemo } from 'react'
import type { AssetRow } from '../../../types'
import type { SftpFileEntry } from '../../../types/sftp'
import type { SftpSessionId } from '../../../stores/useSftpStore'
import SftpNavBar from './SftpNavBar'
import SftpFileList from './SftpFileList'
import SftpLocalFileList from './SftpLocalFileList'
import SftpRemotePaneHeader from './SftpRemotePaneHeader'
import SftpHostPicker from './SftpHostPicker'
import type { ActivePane, PaneHostKind, PaneSide } from './panel-types'

type SessionViewState = {
  connected: boolean
  connecting: boolean
}

interface PaneRenderProps {
  side: PaneSide
  sessionId: SftpSessionId
  title: string
  active: boolean
  hostKind: PaneHostKind
  showPicker: boolean
  session: SessionViewState
  onActivate: () => void
  onShowPicker: () => void
  onSelectLocal: () => void
  onSelectAsset: (asset: AssetRow) => void
  onNavigate: (path: string) => void
  onListDir: (path: string) => void
  onRefresh: () => void
  onContextMenu: (side: PaneSide, e: React.MouseEvent, entry: SftpFileEntry) => void
  onBlankContextMenu: (side: PaneSide, e: React.MouseEvent) => void
  onDoubleClick: (sessionId: SftpSessionId, entry: SftpFileEntry) => void
  onFileDrop: (sessionId: SftpSessionId, files: File[]) => void
  onRemoteDrop: (entries: SftpFileEntry[], sourceSessionId: SftpSessionId) => void
  onRename: (oldPath: string, newName: string) => void
}

function SftpWorkspacePane(props: PaneRenderProps) {
  const {
    side,
    sessionId,
    title,
    active,
    hostKind,
    showPicker,
    session,
    onActivate,
    onShowPicker,
    onSelectLocal,
    onSelectAsset,
    onNavigate,
    onListDir,
    onRefresh,
    onContextMenu,
    onBlankContextMenu,
    onDoubleClick,
    onFileDrop,
    onRemoteDrop,
    onRename,
  } = props

  return (
    <div
      className={`min-w-0 min-h-0 h-full flex-1 flex flex-col transition-opacity ${active ? 'opacity-100' : 'opacity-90'}`}
      onMouseDown={onActivate}
    >
      {showPicker ? (
        <SftpHostPicker
          title={side === 'left' ? '左侧 Host' : '右侧 Host'}
          connecting={session.connecting}
          onSelectLocal={onSelectLocal}
          onSelectAsset={(asset) => onSelectAsset(asset)}
        />
      ) : hostKind === 'local' ? (
        <SftpLocalFileList title={title} active={active} embedded onTitleClick={onShowPicker} />
      ) : (
        <>
          <SftpRemotePaneHeader
            sessionId={sessionId}
            title={title}
            active={active}
            onNavigate={onNavigate}
            onRefresh={onRefresh}
            onListDir={(path) => onListDir(path)}
            onTitleClick={onShowPicker}
          />
          {session.connected || session.connecting ? (
            <SftpFileList
              sessionId={sessionId}
              onNavigate={onNavigate}
              onContextMenu={(e, entry) => onContextMenu(side, e, entry)}
              onBlankContextMenu={(e) => onBlankContextMenu(side, e)}
              onDoubleClick={(entry) => onDoubleClick(sessionId, entry)}
              onFileDrop={(files) => onFileDrop(sessionId, files)}
              onRemoteDrop={onRemoteDrop}
              onRename={onRename}
            />
          ) : (
            <SftpHostPicker
              title={side === 'left' ? '左侧 Host' : '右侧 Host'}
              connecting={session.connecting}
              onSelectLocal={onSelectLocal}
              onSelectAsset={(asset) => onSelectAsset(asset)}
            />
          )}
        </>
      )}
    </div>
  )
}

interface SftpPanelContentProps {
  isWorkspace: boolean
  activePane: ActivePane
  rightConnecting: boolean
  rightConnected: boolean
  left: PaneRenderProps
  right: PaneRenderProps
}

export default function SftpPanelContent(props: SftpPanelContentProps) {
  const {
    isWorkspace,
    activePane,
    rightConnected,
    rightConnecting,
    left,
    right,
  } = props

  const sideConnected = useMemo(() => rightConnected || rightConnecting, [rightConnected, rightConnecting])

  if (isWorkspace) {
    return (
      <div className="flex-1 min-h-0 px-4 pb-4">
        <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="min-w-0 min-h-0 h-full flex-1 basis-0 flex flex-col border-r border-gray-100">
            <SftpWorkspacePane {...left} active={activePane === 'local'} />
          </div>
          <div className="min-w-0 min-h-0 h-full flex-1 basis-0 flex flex-col">
            <SftpWorkspacePane {...right} active={activePane === 'remote'} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SftpNavBar
        onNavigate={right.onNavigate}
        onRefresh={right.onRefresh}
        onListDir={(path) => right.onListDir(path)}
      />
      <div className="flex-1 flex flex-col min-h-0 mx-3 mb-3 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <SftpFileList
          sessionId="right"
          onNavigate={right.onNavigate}
          onContextMenu={(e, entry) => right.onContextMenu('right', e, entry)}
          onBlankContextMenu={(e) => right.onBlankContextMenu('right', e)}
          onDoubleClick={(entry) => right.onDoubleClick('right', entry)}
          onFileDrop={(files) => right.onFileDrop('right', files)}
          onRemoteDrop={right.onRemoteDrop}
          onRename={right.onRename}
        />
        {!sideConnected && (
          <SftpHostPicker
            title="右侧 Host"
            connecting={right.session.connecting}
            onSelectLocal={right.onSelectLocal}
            onSelectAsset={(asset) => right.onSelectAsset(asset)}
          />
        )}
      </div>
    </div>
  )
}
