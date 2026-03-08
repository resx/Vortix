/* ── GitHub Release 更新检测 ── */

export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  releaseUrl: string
  releaseNotes: string
  publishedAt: string
}

interface GitHubRelease {
  tag_name: string
  html_url: string
  body: string
  prerelease: boolean
  published_at: string
}

const REPO = 'resx/Vortix'

/** 比较语义化版本号，返回 true 表示 remote > local */
function isNewer(local: string, remote: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const l = parse(local)
  const r = parse(remote)
  for (let i = 0; i < Math.max(l.length, r.length); i++) {
    const a = l[i] ?? 0
    const b = r[i] ?? 0
    if (b > a) return true
    if (b < a) return false
  }
  return false
}

export async function checkForUpdate(
  channel: 'stable' | 'experimental' = 'stable',
): Promise<UpdateCheckResult> {
  const currentVersion = __APP_VERSION__

  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`)
  if (!res.ok) throw new Error(`GitHub API 请求失败: ${res.status}`)

  const releases: GitHubRelease[] = await res.json()
  const target = channel === 'stable'
    ? releases.find(r => !r.prerelease)
    : releases[0]

  if (!target) {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseUrl: '',
      releaseNotes: '',
      publishedAt: '',
    }
  }

  const latestVersion = target.tag_name.replace(/^v/, '')

  return {
    hasUpdate: isNewer(currentVersion, latestVersion),
    currentVersion,
    latestVersion,
    releaseUrl: target.html_url,
    releaseNotes: target.body || '',
    publishedAt: target.published_at,
  }
}
