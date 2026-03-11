import type { ComponentType } from 'react'
import { AppIcon } from './AppIcon'

/* ── 协议图标系统 ── */
/* 品牌图标来源：simple-icons (MIT License) */
/* 非品牌图标：自定义 SVG */

interface IconProps {
  className?: string
  size?: number
}

export type ProtocolIconVariant = 'asset' | 'menu'

interface ProtocolIconEntry {
  assetIcon: ComponentType<IconProps>
  menuIcon?: ComponentType<IconProps>
  color: string
}

function MenuGlyph({
  icon,
  className,
  size = 14,
  scale = 1,
  offsetY = 0,
}: IconProps & {
  icon: string
  scale?: number
  offsetY?: number
}) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translateY(${offsetY}px) scale(${scale})`,
        transformOrigin: 'center',
      }}
    >
      <AppIcon icon={icon} size={size} />
    </span>
  )
}

/* ── 非品牌协议图标（使用 currentColor） ── */

/** SSH 资产图标 — 更克制的终端窗口 */
export function SshAssetIcon({ className, size = 14 }: IconProps) {
  return <AppIcon icon="ph:terminal-window-fill" size={size} className={className} />
}

/** SSH 菜单图标 — 识别度更强的命令终端 */
export function SshMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="ph:terminal-window-light" size={size} className={className} scale={1.08} />
}

/** 本地终端资产图标 — 与 SSH 同家族，依靠颜色补充区分 */
export function LocalTermAssetIcon({ className, size = 14 }: IconProps) {
  return <AppIcon icon="ph:terminal-fill" size={size} className={className} />
}

/** 本地终端菜单图标 — 更像常见控制台入口 */
export function LocalTermMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="ph:terminal-window-fill" size={size} className={className} scale={1.08} />
}

/** SSH Tunnel 资产图标 — 使用填充网络节点强化可见性 */
export function SshTunnelAssetIcon({ className, size = 14 }: IconProps) {
  return <AppIcon icon="ph:network-fill" size={size} className={className} />
}

/** SSH Tunnel 菜单图标 — 保持轻线性网络语义 */
export function SshTunnelMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="ph:network-light" size={size} className={className} scale={1.04} />
}

/** Telnet 资产图标 — 沿用局域网连接语义，依赖颜色区分 */
export function TelnetAssetIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="mdi:local-area-network-connect" size={size} className={className} scale={1.03} />
}

/** Telnet 菜单图标 — 使用指定的网络连接图标 */
export function TelnetMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="mdi:local-area-network-connect" size={size} className={className} scale={1.03} />
}

/** 串口 资产图标 — 稍微放大以贴近列表中其他协议图标的体量 */
export function SerialAssetIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="mdi:serial-port" size={size} className={className} scale={1.08} />
}

/** 串口 菜单图标 */
export function SerialMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="mdi:serial-port" size={size} className={className} scale={1.08} />
}

/** SFTP — 文件 + 双向箭头 */
export function SftpIcon({ className, size = 14 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 14l-2 2 2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 14l2 2-2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** RDP 资产图标 — 更统一的远程桌面符号 */
export function RdpAssetIcon({ className, size = 14 }: IconProps) {
  return <AppIcon icon="ph:desktop-fill" size={size} className={className} />
}

/** RDP 菜单图标 — 更强调远程桌面语义 */
export function RdpMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="mdi:remote-desktop" size={size} className={className} scale={1.04} offsetY={0.2} />
}

/* ── 品牌图标（使用品牌色） ── */

/** Docker — 鲸鱼 + 容器 (simple-icons, #2496ED) */
export function DockerIcon({ className, size = 14 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" />
    </svg>
  )
}

export function DockerMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="la:docker" size={size} className={className} scale={1.15} offsetY={0.2} />
}

/** Redis (simple-icons, #DC382D) */
export function RedisIcon({ className, size = 14 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.71 13.145c-1.66 2.092-3.452 4.483-7.038 4.483-3.203 0-4.397-2.825-4.48-5.12.701 1.484 2.073 2.685 4.214 2.63 4.117-.133 6.94-3.852 6.94-7.239 0-4.05-3.022-6.972-8.268-6.972-3.752 0-8.4 1.428-11.455 3.685C2.59 6.937 3.885 9.958 4.35 9.626c2.648-1.904 4.748-3.13 6.784-3.744C8.12 9.244.886 17.05 0 18.425c.1 1.261 1.66 4.648 2.424 4.648.232 0 .431-.133.664-.365a100.49 100.49 0 005.54-6.765c.222 3.104 1.748 6.898 6.014 6.898 3.819 0 7.604-2.756 9.33-8.965.2-.764-.73-1.361-1.261-.73zm-4.349-5.013c0 1.959-1.926 2.922-3.685 2.922-.941 0-1.664-.247-2.235-.568 1.051-1.592 2.092-3.225 3.21-4.973 1.972.334 2.71 1.43 2.71 2.619z" />
    </svg>
  )
}

export function RedisMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="devicon-plain:redis" size={size} className={className} scale={1.08} />
}

/** MySQL (simple-icons, #4479A1) */
export function MysqlIcon({ className, size = 14 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.405 5.501c-.115 0-.193.014-.274.033v.013h.014c.054.104.146.18.214.273.054.107.1.214.154.32l.014-.015c.094-.066.14-.172.14-.333-.04-.047-.046-.094-.08-.14-.04-.067-.126-.1-.18-.153zM5.77 18.695h-.927a50.854 50.854 0 00-.27-4.41h-.008l-1.41 4.41H2.45l-1.4-4.41h-.01a72.892 72.892 0 00-.195 4.41H0c.055-1.966.192-3.81.41-5.53h1.15l1.335 4.064h.008l1.347-4.064h1.095c.242 2.015.384 3.86.428 5.53zm4.017-4.08c-.378 2.045-.876 3.533-1.492 4.46-.482.716-1.01 1.073-1.583 1.073-.153 0-.34-.046-.566-.138v-.494c.11.017.24.026.386.026.268 0 .483-.075.647-.222.197-.18.295-.382.295-.605 0-.155-.077-.47-.23-.944L6.23 14.615h.91l.727 2.36c.164.536.233.91.205 1.123.4-1.064.678-2.227.835-3.483zm12.325 4.08h-2.63v-5.53h.885v4.85h1.745zm-3.32.135l-1.016-.5c.09-.076.177-.158.255-.25.433-.506.648-1.258.648-2.253 0-1.83-.718-2.746-2.155-2.746-.704 0-1.254.232-1.65.697-.43.508-.646 1.256-.646 2.245 0 .972.19 1.686.574 2.14.35.41.877.615 1.583.615.264 0 .506-.033.725-.098l1.325.772.36-.622zM15.5 17.588c-.225-.36-.337-.94-.337-1.736 0-1.393.424-2.09 1.27-2.09.443 0 .77.167.977.5.224.362.336.936.336 1.723 0 1.404-.424 2.108-1.27 2.108-.445 0-.77-.167-.978-.5zm-1.658-.425c0 .47-.172.856-.516 1.156-.344.3-.803.45-1.384.45-.543 0-1.064-.172-1.573-.515l.237-.476c.438.22.833.328 1.19.328.332 0 .593-.073.783-.22a.754.754 0 00.3-.615c0-.33-.23-.61-.648-.845-.388-.213-1.163-.657-1.163-.657-.422-.307-.632-.636-.632-1.177 0-.45.157-.81.47-1.085.315-.278.72-.415 1.22-.415.512 0 .98.136 1.4.41l-.213.476a2.726 2.726 0 00-1.064-.23c-.283 0-.502.068-.654.206a.685.685 0 00-.248.524c0 .328.234.61.666.85.393.215 1.187.67 1.187.67.433.305.648.63.648 1.168zm9.382-5.852c-.535-.014-.95.04-1.297.188-.1.04-.26.04-.274.167.055.053.063.14.11.214.08.134.218.313.346.407.14.11.28.216.427.31.26.16.555.255.81.416.145.094.293.213.44.313.073.05.12.14.214.172v-.02c-.046-.06-.06-.147-.105-.214-.067-.067-.134-.127-.2-.193a3.223 3.223 0 00-.695-.675c-.214-.146-.682-.35-.77-.595l-.013-.014c.146-.013.32-.066.46-.106.227-.06.435-.047.67-.106.106-.027.213-.06.32-.094v-.06c-.12-.12-.21-.283-.334-.395a8.867 8.867 0 00-1.104-.823c-.21-.134-.476-.22-.697-.334-.08-.04-.214-.06-.26-.127-.12-.146-.19-.34-.275-.514a17.69 17.69 0 01-.547-1.163c-.12-.262-.193-.523-.34-.763-.69-1.137-1.437-1.826-2.586-2.5-.247-.14-.543-.2-.856-.274-.167-.008-.334-.02-.5-.027-.11-.047-.216-.174-.31-.235-.38-.24-1.364-.76-1.644-.072-.18.434.267.862.422 1.082.115.153.26.328.34.5.047.116.06.235.107.356.106.294.207.622.347.897.073.14.153.287.247.413.054.073.146.107.167.227-.094.136-.1.334-.154.5-.24.757-.146 1.693.194 2.25.107.166.362.534.703.393.3-.12.234-.5.32-.835.02-.08.007-.133.048-.187v.015c.094.188.188.367.274.555.206.328.566.668.867.895.16.12.287.328.487.402v-.02h-.015c-.043-.058-.1-.086-.154-.133a3.445 3.445 0 01-.35-.4 8.76 8.76 0 01-.747-1.218c-.11-.21-.202-.436-.29-.643-.04-.08-.04-.2-.107-.24-.1.146-.247.273-.32.453-.127.288-.14.642-.188 1.01-.027.007-.014 0-.027.014-.214-.052-.287-.274-.367-.46-.2-.475-.233-1.238-.06-1.785.047-.14.247-.582.167-.716-.042-.127-.174-.2-.247-.303a2.478 2.478 0 01-.24-.427c-.16-.374-.24-.788-.414-1.162-.08-.173-.22-.354-.334-.513-.127-.18-.267-.307-.368-.52-.033-.073-.08-.194-.027-.274.014-.054.042-.075.094-.09.088-.072.335.022.422.062.247.1.455.194.662.334.094.066.195.193.315.226h.14c.214.047.455.014.655.073.355.114.675.28.962.46a5.953 5.953 0 012.085 2.286c.08.154.115.295.188.455.14.33.313.663.455.982.14.315.275.636.476.897.1.14.502.213.682.286.133.06.34.115.46.188.23.14.454.3.67.454.11.076.443.243.463.378z" />
    </svg>
  )
}

/** MariaDB (simple-icons, #003545) */
export function MariadbIcon({ className, size = 14 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.157 4.412c-.676.284-.79.31-1.673.372-.65.045-.757.057-1.212.209-.75.246-1.395.75-2.02 1.59-.296.398-1.249 1.913-1.249 1.988 0 .057-.65.998-.915 1.32-.574.713-1.08 1.079-2.14 1.59-.77.36-1.224.524-4.102 1.477-1.073.353-2.133.738-2.367.864-.852.449-1.515 1.036-2.203 1.938-1.003 1.32-.972 1.313-3.042.947a12.264 12.264 0 00-.675-.063c-.644-.05-1.023.044-1.332.334L0 17.193l.177.088c.094.05.353.234.561.398.215.17.461.347.55.391.088.044.17.088.183.101.012.013-.089.17-.228.353-.435.581-.593.871-.574 1.048.019.164.032.17.43.17.517-.006.826-.056 1.261-.208.65-.233 2.058-.94 2.784-1.4.776-.5 1.717-.998 1.956-1.042.082-.02.354-.07.594-.114.58-.107 1.464-.095 2.587.05.108.013.373.045.6.064.227.025.43.057.454.076.026.012.474.037.998.056.934.026 1.104.007 1.3-.189.126-.133.385-.631.498-.985.209-.643.417-.921.366-.492-.113.966-.322 1.692-.713 2.411-.259.499-.663 1.092-.934 1.395-.322.347-.315.36.088.315.619-.063 1.471-.397 2.096-.82.827-.562 1.647-1.691 2.19-3.03.107-.27.22-.22.183.083-.013.094-.038.315-.057.498l-.031.328.353-.202c.833-.48 1.414-1.262 2.127-2.884.227-.518.877-2.922 1.073-3.976a9.64 9.64 0 01.271-1.042c.127-.429.196-.555.48-.858.183-.19.625-.555.978-.808.72-.505.953-.75 1.187-1.205.208-.417.284-1.13.132-1.357-.132-.202-.284-.196-.763.006Z" />
    </svg>
  )
}

export function MariadbMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="simple-icons:mariadbfoundation" size={size} className={className} scale={1.04} />
}

/** PostgreSQL (simple-icons, #4169E1) */
export function PostgresqlIcon({ className, size = 14 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.5594 14.7228a.5269.5269 0 00-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 00-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 00-.5159-.0816 8.044 8.044 0 00-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 00.0004.0041 11.0312 11.0312 0 00-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 00.0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698z" />
    </svg>
  )
}

export function PostgresqlMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="simple-icons:postgresql" size={size} className={className} scale={1.02} />
}

/** ClickHouse (simple-icons, #FFCC01) */
export function ClickhouseIcon({ className, size = 14 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.333 10H24v4h-2.667ZM16 1.335h2.667v21.33H16Zm-5.333 0h2.666v21.33h-2.666ZM0 22.665V1.335h2.667v21.33zm5.333-21.33H8v21.33H5.333Z" />
    </svg>
  )
}

export function ClickhouseMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="devicon-plain:clickhouse" size={size} className={className} scale={1.08} />
}

/** SQLite (simple-icons, #003B57) */
export function SqliteIcon({ className, size = 14 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.678.521c-1.032-.92-2.28-.55-3.513.544a8.71 8.71 0 00-.547.535c-2.109 2.237-4.066 6.38-4.674 9.544.237.48.422 1.093.544 1.561a13.044 13.044 0 01.164.703s-.019-.071-.096-.296l-.05-.146a1.689 1.689 0 00-.033-.08c-.138-.32-.518-.995-.686-1.289-.143.423-.27.818-.376 1.176.484.884.778 2.4.778 2.4s-.025-.099-.147-.442c-.107-.303-.644-1.244-.772-1.464-.217.804-.304 1.346-.226 1.478.152.256.296.698.422 1.186.286 1.1.485 2.44.485 2.44l.017.224a22.41 22.41 0 00.056 2.748c.095 1.146.273 2.13.5 2.657l.155-.084c-.334-1.038-.47-2.399-.41-3.967.09-2.398.642-5.29 1.661-8.304 1.723-4.55 4.113-8.201 6.3-9.945-1.993 1.8-4.692 7.63-5.5 9.788-.904 2.416-1.545 4.684-1.931 6.857.666-2.037 2.821-2.912 2.821-2.912s1.057-1.304 2.292-3.166c-.74.169-1.955.458-2.362.629-.6.251-.762.337-.762.337s1.945-1.184 3.613-1.72C21.695 7.9 24.195 2.767 21.678.521m-18.573.543A1.842 1.842 0 001.27 2.9v16.608a1.84 1.84 0 001.835 1.834h9.418a22.953 22.953 0 01-.052-2.707c-.006-.062-.011-.141-.016-.2a27.01 27.01 0 00-.473-2.378c-.121-.47-.275-.898-.369-1.057-.116-.197-.098-.31-.097-.432 0-.12.015-.245.037-.386a9.98 9.98 0 01.234-1.045l.217-.028c-.017-.035-.014-.065-.031-.097l-.041-.381a32.8 32.8 0 01.382-1.194l.2-.019c-.008-.016-.01-.038-.018-.053l-.043-.316c.63-3.28 2.587-7.443 4.8-9.791.066-.069.133-.128.198-.194Z" />
    </svg>
  )
}

export function SqliteMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="devicon-plain:sqlite" size={size} className={className} scale={1.04} />
}

/** Oracle — 椭圆环 (品牌色 #F80000) */
export function OracleIcon({ className, size = 14 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.17 4.5C3.21 4.5 0 7.71 0 11.67s3.21 7.17 7.17 7.17h9.66c3.96 0 7.17-3.21 7.17-7.17S20.79 4.5 16.83 4.5H7.17zm0 2.16h9.66c2.76 0 5.01 2.25 5.01 5.01s-2.25 5.01-5.01 5.01H7.17c-2.76 0-5.01-2.25-5.01-5.01s2.25-5.01 5.01-5.01z" />
    </svg>
  )
}

export function OracleMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="streamline-logos:oracle-logo-solid" size={size} className={className} scale={1.12} />
}

/** SQL Server — 更接近官方常见的红色飘带标识 */
export function SqlServerIcon({ className, size = 14 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M11.8 2.8c2.18.72 4.4 1.97 6.33 3.66-1.38 1.35-3.48 2.77-6.09 3.64-2.07.7-4.11.95-5.82.83 1.24-1.2 3.22-2.82 5.58-4.11Z" fill="currentColor" />
      <path d="M6.1 11.79c1.77.2 3.86-.02 6-.74 2.82-.95 5.09-2.49 6.59-3.96.9 1.14 1.63 2.39 2.12 3.72-1.4 1.49-3.73 3.1-6.74 4.11-2.52.85-4.94 1.08-6.88.82-.57-.8-.94-1.82-1.09-2.95Z" fill="currentColor" opacity="0.78" />
      <path d="M7.27 16.44c1.95.15 4.22-.14 6.5-.91 2.85-.96 5.3-2.52 7-4.17.16 2.03-.4 4.05-1.73 5.9-1.84 1.04-3.84 1.95-5.76 2.59-2.43.82-4.58 1.18-6.24 1.17-.95-1.16-1.56-2.77-1.77-4.58Z" fill="currentColor" opacity="0.52" />
    </svg>
  )
}

export function MysqlMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="fontisto:mysql" size={size} className={className} scale={1.08} />
}

export function SqlServerMenuIcon({ className, size = 14 }: IconProps) {
  return <MenuGlyph icon="devicon-plain:microsoftsqlserver" size={size} className={className} scale={1.06} />
}

/** 达梦数据库 — 更贴近官方常见的 DM 字标 */
export function DamengIcon({ className, size = 14 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3.5 6.5h6.3c2.96 0 5.2 2.16 5.2 5.5s-2.24 5.5-5.2 5.5H3.5Zm3 2.65v5.7h2.9c1.44 0 2.58-.94 2.58-2.85 0-1.87-1.14-2.85-2.58-2.85Z" fill="currentColor" />
      <path d="M16.2 17.5V6.5h1.95l2.2 3.48L22.55 6.5H23.1v11h-2.45v-5.5l-1.7 2.6h-.22L16.98 12v5.5Z" fill="currentColor" />
    </svg>
  )
}

export function DamengMenuIcon({ className, size = 14 }: IconProps) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'translateY(0.1px) scale(0.94)',
        transformOrigin: 'center',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 1024 1024" fill="currentColor" aria-hidden="true">
        <path d="M310.592 288c-8.192 57.6 0.704 107.84 27.52 149.76 28.8 44.992 76.864 78.656 142.976 101.184l32.64 10.496c50.816 17.6 85.44 41.984 105.216 72.896 19.776 30.912 25.856 70.144 17.28 118.72l-3.008 14.848-5.952 26.304c-13.76 6.336-27.52 12.288-41.216 17.792 7.168-56-1.92-104.832-28.16-145.856-28.8-44.992-76.864-78.592-142.976-101.12l-32.64-10.496c-50.816-17.6-85.44-41.984-105.216-72.896-19.776-30.912-25.856-70.208-17.28-118.72l3.008-14.848 4.864-21.184c10.88-7.36 22.208-14.528 33.792-21.44l9.152-5.44z m86.144-46.208c13.76-6.336 27.52-12.224 41.28-17.792-7.232 56 1.92 104.832 28.16 145.856 28.736 44.992 76.8 78.592 142.912 101.12l32.64 10.496c50.816 17.6 85.44 41.984 105.216 72.896 19.776 30.848 25.856 70.144 17.28 118.72l-3.008 14.848-4.8 21.12c-13.824 9.28-28.16 18.24-43.008 26.944 8.192-57.728-0.704-107.904-27.52-149.824-28.8-44.992-76.864-78.592-142.976-101.12l-32.64-10.496C459.52 456.96 424.832 432.64 405.12 401.664c-19.776-30.912-25.856-70.144-17.28-118.72l3.008-14.848 5.952-26.24-0.064-0.064zM210.752 352c-2.304 50.048 6.656 94.272 27.328 132.16 26.048 47.872 69.76 83.584 129.664 107.584l29.632 11.136c46.144 18.752 77.568 44.672 95.488 77.568 17.92 32.832 23.488 74.624 15.68 126.272l-2.688 15.808-1.536 7.68c-182.4 63.808-352.896 37.056-416-78.528-58.24-106.944-8.448-260.224 112.832-389.632l9.6-10.048zM519.68 193.792c182.4-63.808 352.896-37.056 416 78.528 59.776 109.696 5.76 268.16-122.496 399.68 2.368-50.112-6.592-94.336-27.264-132.224-26.048-47.808-69.76-83.584-129.664-107.52l-29.632-11.2c-46.144-18.688-77.568-44.608-95.488-77.504-17.92-32.896-23.488-74.688-15.68-126.272l2.688-15.808 1.536-7.68z" />
      </svg>
    </span>
  )
}

/** 通用数据库 — 圆柱体 (用于未匹配的数据库类型) */
export function GenericDbIcon({ className, size = 14 }: IconProps) {
  return <AppIcon icon="ph:database-fill" size={size} className={className} />
}

/** 菜单数据库图标 — 黑白线性风格 */
export function GenericDbMenuIcon({ className, size = 14 }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="6" rx="7.5" ry="2.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 6v11.5c0 1.52 3.36 2.75 7.5 2.75s7.5-1.23 7.5-2.75V6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 11.75c0 1.52 3.36 2.75 7.5 2.75s7.5-1.23 7.5-2.75" stroke="currentColor" strokeWidth="1.6" opacity="0.7" />
    </svg>
  )
}

/* ── 协议 → 图标/颜色映射 ── */

const PROTOCOL_MAP: Record<string, ProtocolIconEntry> = {
  ssh:        { assetIcon: SshAssetIcon,       menuIcon: SshMenuIcon,       color: 'text-icon-terminal' },
  local:      { assetIcon: LocalTermAssetIcon, menuIcon: LocalTermMenuIcon, color: 'text-[#8B5CF6]' },
  'ssh-tunnel': { assetIcon: SshTunnelAssetIcon, menuIcon: SshTunnelMenuIcon, color: 'text-[#0284C7]' },
  telnet:     { assetIcon: TelnetAssetIcon,    menuIcon: TelnetMenuIcon,    color: 'text-[#0F766E]' },
  serial:     { assetIcon: SerialAssetIcon,    menuIcon: SerialMenuIcon,    color: 'text-[#D97706]' },
  docker:     { assetIcon: DockerIcon,         menuIcon: DockerMenuIcon,     color: 'text-[#2496ED]' },
  redis:      { assetIcon: RedisIcon,          menuIcon: RedisMenuIcon,      color: 'text-[#DC382D]' },
  mysql:      { assetIcon: MysqlIcon,          menuIcon: MysqlMenuIcon,      color: 'text-[#4479A1]' },
  mariadb:    { assetIcon: MariadbIcon,        menuIcon: MariadbMenuIcon,    color: 'text-[#003545]' },
  postgresql: { assetIcon: PostgresqlIcon,     menuIcon: PostgresqlMenuIcon, color: 'text-[#4169E1]' },
  sqlserver:  { assetIcon: SqlServerIcon,      menuIcon: SqlServerMenuIcon,  color: 'text-[#CC2927]' },
  clickhouse: { assetIcon: ClickhouseIcon,     menuIcon: ClickhouseMenuIcon, color: 'text-[#FABC2C]' },
  sqlite:     { assetIcon: SqliteIcon,         menuIcon: SqliteMenuIcon,     color: 'text-[#003B57]' },
  oracle:     { assetIcon: OracleIcon,         menuIcon: OracleMenuIcon,     color: 'text-[#F80000]' },
  dameng:     { assetIcon: DamengIcon,         menuIcon: DamengMenuIcon,     color: 'text-[#D4001A]' },
  sftp:       { assetIcon: SftpIcon,           color: 'text-icon-action' },
  rdp:        { assetIcon: RdpAssetIcon,       menuIcon: RdpMenuIcon,       color: 'text-primary' },
  database:   { assetIcon: GenericDbIcon,      menuIcon: GenericDbMenuIcon, color: 'text-chart-green' },
}

/** 根据协议类型渲染对应图标（统一入口） */
export function ProtocolIcon({
  protocol,
  className,
  size,
  mono,
  variant = 'asset',
}: {
  protocol?: string
  className?: string
  size?: number
  mono?: boolean
  variant?: ProtocolIconVariant
}) {
  const entry = PROTOCOL_MAP[protocol || 'ssh'] || PROTOCOL_MAP.ssh
  const Icon = variant === 'menu' ? (entry.menuIcon ?? entry.assetIcon) : entry.assetIcon
  return <Icon className={`${mono ? '' : entry.color} ${className || ''}`} size={size} />
}

/** 数据库标签 → 协议 key 映射 */
// eslint-disable-next-line react-refresh/only-export-components
export const DB_LABEL_PROTOCOL: Record<string, string> = {
  'Redis': 'redis', 'MySQL': 'mysql', 'MariaDB': 'mariadb',
  'PostgreSQL': 'postgresql', 'SqlServer': 'sqlserver', 'ClickHouse': 'clickhouse',
  'SQLite': 'sqlite', 'Oracle': 'oracle', '达梦': 'dameng',
}
