import { memo, type CSSProperties } from 'react'
import { Icon, addCollection } from '@iconify/react/offline'
import phIcons from '@iconify-json/ph/icons.json'
import mdiIcons from '@iconify-json/mdi/icons.json'
import laIcons from '@iconify-json/la/icons.json'
import deviconPlainIcons from '@iconify-json/devicon-plain/icons.json'
import fontistoIcons from '@iconify-json/fontisto/icons.json'
import simpleIcons from '@iconify-json/simple-icons/icons.json'
import streamlineLogosIcons from '@iconify-json/streamline-logos/icons.json'
import { cn } from '../../lib/utils'

addCollection(phIcons)
addCollection(mdiIcons)
addCollection(laIcons)
addCollection(deviconPlainIcons)
addCollection(fontistoIcons)
addCollection(simpleIcons)
addCollection(streamlineLogosIcons)

// eslint-disable-next-line react-refresh/only-export-components
export const icons = {
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
  eye: 'ph:eye',
  eyeOff: 'ph:eye-slash',
  folder: 'ph:folder',
  folderFill: 'ph:folder-fill',
  folderPlus: 'ph:folder-plus',
  folderOpen: 'ph:folder-open',
  folderOpenFill: 'ph:folder-open-fill',
  folderArchive: 'ph:folder-simple-dashed',
  file: 'ph:file',
  fileText: 'ph:file-text',
  filePlus: 'ph:file-plus',
  fileX: 'ph:file-x',
  fileDown: 'ph:file-arrow-down',
  fileUp: 'ph:file-arrow-up',
  fileEdit: 'ph:note-pencil',
  download: 'ph:download-simple',
  upload: 'ph:upload-simple',
  externalLink: 'ph:arrow-square-out',
  chevronRight: 'ph:caret-right',
  chevronDown: 'ph:caret-down',
  chevronUp: 'ph:caret-up',
  chevronLeft: 'ph:caret-left',
  arrowLeft: 'ph:arrow-left',
  arrowRight: 'ph:arrow-right',
  arrowUpRight: 'ph:arrow-up-right',
  home: 'ph:house',
  minimize: 'ph:minus',
  maximize: 'ph:square',
  pin: 'ph:push-pin',
  pinOff: 'ph:push-pin-slash',
  moreVertical: 'ph:dots-three-vertical',
  appWindow: 'ph:app-window',
  terminal: 'ph:terminal-window',
  localTerminal: 'ph:terminal',
  terminalSquare: 'ph:terminal-window',
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
  flowArrow: 'ph:flow-arrow',
  alertCircle: 'ph:warning-circle',
  alertTriangle: 'ph:warning',
  info: 'ph:info',
  checkCircle: 'ph:check-circle',
  loader: 'ph:spinner',
  activity: 'ph:activity',
  sun: 'ph:sun',
  moon: 'ph:moon',
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
  cloudFog: 'ph:cloud',
  hardDrive: 'ph:hard-drives',
  squareX: 'ph:x-square',
  squareArrowOutUpRight: 'ph:arrow-square-up-right',
  user: 'ph:user',
  circle: 'ph:circle',
  gripVertical: 'ph:dots-six-vertical',
} as const

export type IconName = keyof typeof icons
export type AppIconName = (typeof icons)[IconName]

interface AppIconProps {
  icon: AppIconName | string
  size?: number
  className?: string
  style?: CSSProperties
}

export const AppIcon = memo(function AppIcon({
  icon,
  size = 16,
  className,
  style,
}: AppIconProps) {
  const resolvedIcon = icon || icons.help

  return (
    <Icon
      icon={resolvedIcon}
      width={size}
      height={size}
      className={cn(className, resolvedIcon === icons.loader && 'animate-spin')}
      style={style}
      aria-hidden="true"
    />
  )
})
