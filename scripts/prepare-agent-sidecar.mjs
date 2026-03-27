import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tauriDir = path.join(repoRoot, 'src-tauri')
const profile = process.argv.includes('--release') ? 'release' : 'debug'
const extension = process.platform === 'win32' ? '.exe' : ''
const source = path.join(tauriDir, 'target', profile, `vortix-agent${extension}`)

if (!existsSync(source)) {
  throw new Error(`未找到 agent 可执行文件: ${source}`)
}

function detectTargetTriple() {
  const key = `${process.platform}-${process.arch}`
  const table = {
    'win32-x64': 'x86_64-pc-windows-msvc',
    'win32-arm64': 'aarch64-pc-windows-msvc',
    'darwin-x64': 'x86_64-apple-darwin',
    'darwin-arm64': 'aarch64-apple-darwin',
    'linux-x64': 'x86_64-unknown-linux-gnu',
    'linux-arm64': 'aarch64-unknown-linux-gnu',
  }
  return table[key]
}

const targetTriple = detectTargetTriple()
if (!targetTriple) {
  throw new Error(`不支持的目标平台: ${process.platform}/${process.arch}`)
}
const binariesDir = path.join(tauriDir, 'binaries')
mkdirSync(binariesDir, { recursive: true })

const destination = path.join(binariesDir, `vortix-agent-${targetTriple}${extension}`)
copyFileSync(source, destination)

console.log(`[agent-sidecar] copied ${source} -> ${destination}`)
