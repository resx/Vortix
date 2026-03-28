import type { ApiResponse } from './types'

interface VortixRuntimeConfig {
  apiBaseUrl?: string
}

const FALLBACK_API_PORTS = [3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012]
const API_DISCOVERY_TIMEOUT_MS = 600
let cachedApiBaseUrl: string | null = null

function readWindowConfig(): VortixRuntimeConfig | undefined {
  return (window as unknown as Record<string, unknown>).__VORTIX_CONFIG__ as VortixRuntimeConfig | undefined
}

function getPreferredApiBaseUrl(): string {
  const config = readWindowConfig()
  if (config?.apiBaseUrl) return config.apiBaseUrl
  return 'http://localhost:3002/api'
}

export function getCurrentApiBaseUrl(): string {
  const config = readWindowConfig()
  if (config?.apiBaseUrl) {
    cachedApiBaseUrl = config.apiBaseUrl
    return config.apiBaseUrl
  }
  if (cachedApiBaseUrl) return cachedApiBaseUrl
  return getPreferredApiBaseUrl()
}

async function isApiHealthy(baseUrl: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), API_DISCOVERY_TIMEOUT_MS)
  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function discoverApiBaseUrl(): Promise<string> {
  const configured = readWindowConfig()?.apiBaseUrl
  const candidates = new Set<string>()
  if (configured) candidates.add(configured)
  if (cachedApiBaseUrl) candidates.add(cachedApiBaseUrl)
  candidates.add(getPreferredApiBaseUrl())

  for (const port of FALLBACK_API_PORTS) {
    candidates.add(`http://127.0.0.1:${port}/api`)
    candidates.add(`http://localhost:${port}/api`)
  }

  for (const baseUrl of candidates) {
    if (await isApiHealthy(baseUrl)) {
      cachedApiBaseUrl = baseUrl
      return baseUrl
    }
  }

  return getCurrentApiBaseUrl()
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...options?.headers,
  }
  let res: Response
  let baseUrl = getCurrentApiBaseUrl()
  if (!readWindowConfig()?.apiBaseUrl && !cachedApiBaseUrl) {
    baseUrl = await discoverApiBaseUrl()
  }
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    })
  } catch {
    const discoveredBaseUrl = await discoverApiBaseUrl()
    res = await fetch(`${discoveredBaseUrl}${path}`, {
      ...options,
      headers,
    })
  }
  const raw = await res.text()
  let json: ApiResponse<T> | null = null
  try {
    json = raw ? JSON.parse(raw) as ApiResponse<T> : null
  } catch {
    const short = raw.slice(0, 240)
    throw new Error(`HTTP ${res.status}: ${short || '响应非 JSON'}`)
  }
  if (!res.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`)
  }
  if (!json?.success) {
    throw new Error(json?.error || '请求失败')
  }
  return json.data as T
}

export function getWsBaseUrl(): string {
  try {
    const url = new URL(getCurrentApiBaseUrl())
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${url.host}`
  } catch {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${location.host}`
  }
}
