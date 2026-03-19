import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import pkg from './package.json' with { type: 'json' }

// Tauri 开发模式通过环境变量 TAURI_DEV 标识
const isTauri = !!process.env.TAURI_ENV_PLATFORM

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
