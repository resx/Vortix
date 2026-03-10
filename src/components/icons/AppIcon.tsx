/* ── 统一图标系统 ── */
/* 基于 @iconify/react，主要使用 Phosphor Icons (ph:) */

import { Icon } from '@iconify/react'

interface AppIconProps {
  icon: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

/** 统一图标组件 — 替代 lucide-react */
export function AppIcon({ icon, size = 16, className, style }: AppIconProps) {
  return <Icon icon={icon} width={size} height={size} className={className} style={style} />
}

/* ── 图标名称常量（语义化 → iconify ID） ── */

export const icons = {
  /* ── 通用操作 ── */
  copy: 'ph:copy',
  clipboard: 'ph:clipboard',
  clipboardText: 'ph:clipboard-text',
  clipboardPaste: 'ph:clipboard',
  scissors: 'ph:scissors',
  edit: 'ph:pencil-simple',
  pencil: 'ph:pencil-simple',
  trash: 'ph:trash',
  search: 'ph:magnifying-glass',
  close: 'ph:x',
  check: 'ph:check',
  plus: 'ph:plus',
  refresh: 'ph:arrows-clockwise',
  settings: 'ph:gear',
  save: 'ph:floppy-disk',
  play: 'ph:play',
  eraser: 'ph:eraser',
  textCursor: 'ph:cursor-text',

  /* ── 可见性 ── */
  eye: 'ph:eye',
  eyeOff: 'ph:eye-slash',

  /* ── 文件/文件夹 ── */
  folder: 'ph:folder',
  folderPlus: 'ph:folder-plus',
  folderOpen: 'ph:folder-open',
  folderArchive: 'ph:folder-simple-dashed',
  file: 'ph:file',
  fileText: 'ph:file-text',
  filePlus: 'ph:file-plus',
  fileX: 'ph:file-x',
  fileDown: 'ph:file-arrow-down',
  fileUp: 'ph:file-arrow-up',
  fileEdit: 'ph:note-pencil',

  /* ── 传输 ── */
  download: 'ph:download-simple',
  upload: 'ph:upload-simple',
  externalLink: 'ph:arrow-square-out',

  /* ── 导航/箭头 ── */
  chevronRight: 'ph:caret-right',
  chevronDown: 'ph:caret-down',
  chevronUp: 'ph:caret-up',
  arrowLeft: 'ph:arrow-left',
  arrowRight: 'ph:arrow-right',
  arrowUpRight: 'ph:arrow-up-right',
  home: 'ph:house',

  /* ── 窗口控制 ── */
  minimize: 'ph:minus',
  maximize: 'ph:square',
  pin: 'ph:push-pin',
  moreVertical: 'ph:dots-three-vertical',
  appWindow: 'ph:app-window',

  /* ── 终端/连接 ── */
  terminal: 'ph:terminal-window',
  localTerminal: 'ph:terminal',
  network: 'ph:globe-simple',
  monitor: 'ph:monitor',
  screenShare: 'ph:desktop',
  container: 'ph:cube',
  database: 'ph:database',
  usb: 'ph:usb',
  key: 'ph:key',
  keyRound: 'ph:key',
  link: 'ph:link',
  unplug: 'ph:plugs',
  globe: 'ph:globe',

  /* ── 状态/提示 ── */
  alertCircle: 'ph:warning-circle',
  alertTriangle: 'ph:warning',
  info: 'ph:info',
  checkCircle: 'ph:check-circle',
  loader: 'ph:spinner',
  activity: 'ph:activity',

  /* ── 主题/外观 ── */
  sun: 'ph:sun',
  moon: 'ph:moon',

  /* ── 菜单/功能 ── */
  history: 'ph:clock-counter-clockwise',
  clock: 'ph:clock',
  languages: 'ph:translate',
  help: 'ph:question',
  logOut: 'ph:sign-out',
  rotateCw: 'ph:arrow-clockwise',
  crosshair: 'ph:crosshair',
  copyPlus: 'ph:copy-simple',
  columns: 'ph:columns',
  splitVertical: 'ph:split-vertical',
  splitHorizontal: 'ph:split-horizontal',
  zap: 'ph:lightning',
  list: 'ph:list',
  alignJustify: 'ph:list',
  scrollText: 'ph:scroll',
  messageCircle: 'ph:chat-circle',
  cloud: 'ph:cloud',
  cloudSun: 'ph:cloud-sun',
  cloudCog: 'ph:cloud-check',
  cloudOff: 'ph:cloud-slash',
  cloudArrowUp: 'ph:cloud-arrow-up',
  cloudArrowDown: 'ph:cloud-arrow-down',
  hardDrive: 'ph:hard-drives',
  squareX: 'ph:x-square',
  squareArrowOutUpRight: 'ph:arrow-square-up-right',
  user: 'ph:user',
  circle: 'ph:circle',
  cloudFog: 'ph:cloud',
  pinOff: 'ph:push-pin-slash',
  chevronLeft: 'ph:caret-left',
  gripVertical: 'ph:dots-six-vertical',
  terminalSquare: 'ph:terminal-window',
} as const

export type IconName = keyof typeof icons
