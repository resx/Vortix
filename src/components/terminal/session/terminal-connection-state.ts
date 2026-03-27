import { t as translate } from '../../../i18n'
import type { ConnectionLoadingStep } from '../ConnectionLoadingView'
import type { ConnectionStagePayload, SshConnection, TerminalConnection } from './terminal-types'

export function getReconnectStageText(current: number, total: number): string {
  if (total > 0 && current > 0) {
    return translate('connectionLoading.phase.reconnectingWithCount', { current, total })
  }
  return translate('connectionLoading.phase.reconnecting')
}

function getConnectionNodeLabel(data: ConnectionStagePayload): string {
  return String(data.connectionName || data.host || translate('connectionLoading.unknownHost'))
}

export function describeConnectionStage(data: ConnectionStagePayload): string {
  const role = data.role === 'jump'
    ? translate('connectionLoading.role.jump')
    : translate('connectionLoading.role.target')
  const nodeLabel = getConnectionNodeLabel(data)
  const prefix = data.hopCount && data.hopCount > 1 && data.hopIndex
    ? `[${data.hopIndex}/${data.hopCount}] `
    : ''

  switch (data.phase) {
    case 'connecting':
      return `${prefix}${translate('connectionLoading.phase.connecting')} ${role} ${nodeLabel}${data.port ? `:${data.port}` : ''}`
    case 'awaiting-hostkey-decision':
      return `${prefix}${translate('connectionLoading.phase.verifying')} ${role} ${nodeLabel}`
    case 'authenticating':
      return `${prefix}${translate('connectionLoading.phase.authenticating')} ${role} ${nodeLabel}`
    case 'connected':
      if (data.role === 'jump') {
        return `${prefix}${nodeLabel} ${translate('connectionLoading.phase.jumpReady')}`
      }
      return `${prefix}${translate('connectionLoading.phase.connectedTo')} ${nodeLabel}`
    default:
      return `${prefix}${nodeLabel}`
  }
}

export function buildConnectionRouteLabel(connection: TerminalConnection | null): string {
  if (!connection) return ''
  if ('type' in connection && connection.type === 'local') {
    return connection.workingDir ? `${connection.shell} - ${connection.workingDir}` : connection.shell
  }

  const sshConnection = connection as SshConnection
  const targetLabel = `${sshConnection.username}@${sshConnection.host}:${sshConnection.port}`
  if (!sshConnection.jump) {
    return targetLabel
  }

  const jumpLabel = `${sshConnection.jump.username}@${sshConnection.jump.host}:${sshConnection.jump.port}`
  return `${jumpLabel} -> ${targetLabel}`
}

function buildConnectionStepId(data: ConnectionStagePayload): string {
  return [
    data.role ?? 'node',
    data.phase ?? 'unknown',
    data.hopIndex ?? 0,
    data.connectionId ?? data.connectionName ?? data.host ?? 'endpoint',
  ].join(':')
}

export function nextConnectionSteps(
  steps: ConnectionLoadingStep[],
  data: ConnectionStagePayload,
  label: string,
): ConnectionLoadingStep[] {
  const next = steps.map((step) => (
    step.status === 'active'
      ? { ...step, status: 'done' as const }
      : step
  ))

  const id = buildConnectionStepId(data)
  const status = data.phase === 'connected' ? 'done' : 'active'
  const index = next.findIndex((step) => step.id === id)

  if (index >= 0) {
    next[index] = { id, label, status }
    return next
  }

  return [...next, { id, label, status }]
}
