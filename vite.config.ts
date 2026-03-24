import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import pkg from './package.json' with { type: 'json' }

// Tauri 开发模式通过环境变量 TAURI_DEV 标识
const isTauri = !!process.env.TAURI_ENV_PLATFORM

/**
 * Iconify 图标裁剪插件
 *
 * 生产构建时自动扫描 src/ 中引用的图标名（如 "ph:lock-simple"），
 * 拦截 @iconify-json 集合 JSON 的加载，仅保留实际使用的图标数据。
 * 开发模式不裁剪，保证 HMR 灵活性。
 */
function iconifyPrune(): Plugin {
  // 支持的图标集前缀
  const PREFIXES = ['ph', 'mdi', 'la', 'devicon-plain', 'fontisto', 'simple-icons', 'streamline-logos']
  const prefixPattern = PREFIXES.map(p => p.replace(/-/g, '\\-')).join('|')
  const iconRegex = new RegExp(`["'\`](${prefixPattern}):([a-z0-9][a-z0-9-]*)["'\`]`, 'g')

  let usedByPrefix: Map<string, Set<string>> | null = null

  /** 递归扫描源码目录，收集所有图标引用 */
  function scanIcons(dir: string): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>()
    function walk(d: string) {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name)
        if (entry.isDirectory() && entry.name !== 'node_modules') { walk(full); continue }
        if (!/\.[jt]sx?$/.test(entry.name)) continue
        const src = fs.readFileSync(full, 'utf-8')
        let m: RegExpExecArray | null
        // 重置 lastIndex 以防万一
        iconRegex.lastIndex = 0
        while ((m = iconRegex.exec(src)) !== null) {
          const prefix = m[1]
          const name = m[2]
          if (!result.has(prefix)) result.set(prefix, new Set())
          result.get(prefix)!.add(name)
        }
      }
    }
    walk(dir)
    return result
  }

  return {
    name: 'vite-plugin-iconify-prune',
    enforce: 'pre',
    configResolved(config) {
      // 仅生产构建时启用裁剪
      if (config.command !== 'build') return
      const srcDir = path.resolve(config.root, 'src')
      usedByPrefix = scanIcons(srcDir)
      // 输出统计
      let total = 0
      for (const [prefix, names] of usedByPrefix) {
        total += names.size
        config.logger.info(`  [iconify-prune] ${prefix}: ${names.size} icons`)
      }
      config.logger.info(`  [iconify-prune] 共保留 ${total} 个图标（已裁剪未使用数据）`)
    },
    load(id) {
      if (!usedByPrefix) return null
      const nid = id.replace(/\\/g, '/')
      if (!nid.includes('@iconify-json/') || !nid.endsWith('/icons.json')) return null

      const raw = fs.readFileSync(id, 'utf-8')
      const collection = JSON.parse(raw)
      const prefix: string = collection.prefix
      const used = usedByPrefix.get(prefix)

      // 该集合无任何引用 → 返回空集合骨架
      if (!used || used.size === 0) {
        const empty = { prefix, icons: {}, width: collection.width, height: collection.height }
        return JSON.stringify(empty)
      }

      // 仅保留被引用的图标
      const prunedIcons: Record<string, unknown> = {}
      for (const name of used) {
        if (collection.icons[name]) prunedIcons[name] = collection.icons[name]
      }

      // 处理别名：保留指向已使用图标的别名，以及自身被引用的别名
      const prunedAliases: Record<string, unknown> = {}
      if (collection.aliases) {
        for (const [alias, data] of Object.entries(collection.aliases as Record<string, { parent: string }>)) {
          if (used.has(alias)) {
            prunedAliases[alias] = data
            // 确保别名的父图标也被保留
            if (collection.icons[data.parent]) prunedIcons[data.parent] = collection.icons[data.parent]
          }
        }
      }

      const pruned: Record<string, unknown> = {
        prefix,
        icons: prunedIcons,
        width: collection.width,
        height: collection.height,
      }
      if (Object.keys(prunedAliases).length > 0) pruned.aliases = prunedAliases

      return JSON.stringify(pruned)
    },
  }
}

export default defineConfig({
  plugins: [iconifyPrune(), react(), tailwindcss()],
  // Tauri 生产模式需要相对路径加载资源
  base: isTauri ? './' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Tauri 开发模式需要固定端口
  server: {
    port: 5173,
    strictPort: true,
    // 排除 Tauri Rust 编译产物，避免频繁 HMR reload
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  // 清除 Tauri Rust 端的 env 变量，避免泄露到前端
  envPrefix: ['VITE_'],
  build: {
    rollupOptions: {
      // 多页面入口：主应用 + 设置窗口
      input: {
        main: path.resolve(__dirname, 'index.html'),
        settings: path.resolve(__dirname, 'settings.html'),
        themeManager: path.resolve(__dirname, 'theme-manager.html'),
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router/')
          ) {
            return 'react-vendor'
          }

          if (id.includes('/@radix-ui/')) {
            return 'radix-vendor'
          }

          if (id.includes('/@xterm/')) {
            return 'terminal-vendor'
          }

          if (
            id.includes('/recharts/') ||
            id.includes('/react-circular-progressbar/') ||
            id.includes('/@tremor/')
          ) {
            return 'chart-vendor'
          }

          if (id.includes('/framer-motion/')) {
            return 'motion-vendor'
          }

          if (
            id.includes('/zustand/') ||
            id.includes('/clsx/') ||
            id.includes('/class-variance-authority/') ||
            id.includes('/tailwind-merge/')
          ) {
            return 'utils-vendor'
          }

          // 图标运行时独立分块
          if (id.includes('/@iconify/') || id.includes('/@iconify-json/')) {
            return 'icon-vendor'
          }
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
