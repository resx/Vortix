import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/noto-sans-sc'
import './assets/fonts/ioskeley-mono/ioskeley-mono.css'
import './index.css'
import ThemeManagerWindow from './components/windows/ThemeManagerWindow'

document.getElementById('app-loader')?.remove()
document.documentElement.classList.add('theme-manager-window')
document.body.classList.add('theme-manager-window-body')
const root = document.getElementById('root')!
root.classList.add('theme-manager-window-root')

createRoot(root).render(
  <StrictMode>
    <ThemeManagerWindow />
  </StrictMode>,
)
