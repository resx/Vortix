import type { ApiResponse, TestResult, UploadSshKeyResult } from '../types'
import { getCurrentApiBaseUrl } from '../http'
import { promptHostKeyTrust } from '../../utils/hostKeyPrompt'

async function postUploadSshKey(
  connectionId: string,
  keyId: string,
  options?: { trustHostKey?: boolean; replaceExisting?: boolean },
): Promise<UploadSshKeyResult> {
  const res = await fetch(`${getCurrentApiBaseUrl()}/connections/${connectionId}/upload-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({
      keyId,
      trustHostKey: options?.trustHostKey,
      replaceExisting: options?.replaceExisting,
    }),
  })
  const payload = await res.json() as ApiResponse<UploadSshKeyResult>
  if (!res.ok) {
    throw new Error(payload?.error || `HTTP ${res.status}`)
  }
  if (!payload?.success) {
    throw new Error(payload?.error || 'Request failed')
  }
  return payload.data ?? {}
}

export async function uploadSshKey(
  connectionId: string,
  keyId: string,
  options?: { trustHostKey?: boolean; replaceExisting?: boolean },
): Promise<{ message: string }> {
  let result = await postUploadSshKey(connectionId, keyId, options)
  let promptCount = 0

  while (result.requiresHostTrust && result.hostKey) {
    if (promptCount >= 6) {
      throw new Error('Too many SSH host trust confirmations.')
    }
    const decision = await promptHostKeyTrust({
      ...result.hostKey,
      requestId: `upload-hostkey-${Date.now()}-${promptCount}`,
    })
    if (decision === 'reject') {
      throw new Error('SSH host trust was rejected.')
    }
    result = await postUploadSshKey(connectionId, keyId, {
      trustHostKey: true,
      replaceExisting: decision === 'replace',
    })
    promptCount += 1
  }

  if (!result.message) {
    throw new Error('SSH public key upload failed.')
  }

  return { message: result.message }
}

async function postTestSshConnection(data: Record<string, unknown>): Promise<TestResult> {
  const res = await fetch(`${getCurrentApiBaseUrl()}/connections/test-ssh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<TestResult>
}

export async function testSshConnection(data: Record<string, unknown>): Promise<TestResult> {
  let result = await postTestSshConnection(data)
  let promptCount = 0

  while (result.requiresHostTrust && result.hostKey) {
    if (promptCount >= 6) {
      return { success: false, error: 'Too many SSH host trust confirmations.' }
    }
    const decision = await promptHostKeyTrust({
      ...result.hostKey,
      requestId: `test-hostkey-${Date.now()}-${promptCount}`,
    })
    if (decision === 'reject') {
      return { success: false, error: 'SSH host trust was rejected.' }
    }

    result = await postTestSshConnection({
      ...data,
      trustHostKey: true,
      replaceExisting: decision === 'replace',
    })
    promptCount += 1
  }

  return result
}

export async function testLocalTerminal(data: { shell: string; workingDir?: string }): Promise<TestResult> {
  const res = await fetch(`${getCurrentApiBaseUrl()}/connections/test-local`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<TestResult>
}

export async function getLocalTerminalDefaultDir(shell: string): Promise<string | undefined> {
  const res = await fetch(`${getCurrentApiBaseUrl()}/connections/local-default-dir`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ shell }),
  })
  const payload = await res.json() as { success?: boolean; path?: string | null; error?: string }
  if (!res.ok || payload.success === false) {
    throw new Error(payload.error || `HTTP ${res.status}`)
  }
  return payload.path ?? undefined
}
