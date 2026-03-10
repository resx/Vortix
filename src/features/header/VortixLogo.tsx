/* ── 全息指令盒 Logo ── */

function GlitchBox({ size = 22 }: { size?: number }) {
  const fontSize = Math.round(size * 0.55)
  const scanLineSize = size <= 24 ? 2 : 4
  const isDark = document.documentElement.classList.contains('dark')
  return (
    <div
      className={`relative rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 ${
        isDark
          ? 'bg-[#000] border border-gray-700 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
          : 'bg-[#111] border border-gray-800 shadow-sm'
      }`}
      style={{ width: size, height: size }}
    >
      {/* CRT 扫描线 */}
      <div
        className="absolute inset-0 z-20 pointer-events-none opacity-40"
        style={{ background: `linear-gradient(transparent 50%, rgba(0,0,0,0.5) 50%)`, backgroundSize: `100% ${scanLineSize}px` }}
      />
      <div className="relative flex font-mono font-black tracking-tighter" style={{ fontSize: `${fontSize}px` }}>
        <span className="absolute text-cyan-400 -left-[1px] top-[1px] mix-blend-screen blur-[0.3px]" style={{ animation: 'holoFlicker 5s infinite' }}>
          &gt;<span style={{ animation: 'terminalBlink 2s step-end infinite' }}>_</span>
        </span>
        <span className="absolute text-rose-500 left-[1px] -top-[1px] mix-blend-screen blur-[0.3px]" style={{ animation: 'holoFlicker 5s infinite 150ms' }}>
          &gt;<span style={{ animation: 'terminalBlink 2s step-end infinite' }}>_</span>
        </span>
        <span className="relative z-10 text-white">
          &gt;<span style={{ animation: 'terminalBlink 2s step-end infinite', filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }}>_</span>
        </span>
      </div>
    </div>
  )
}

/* ── Kinetic Pulse Logo 组合 ── */

export default function VortixLogoGroup({ iconSize = 22, fontSize = '15px' }: { iconSize?: number; fontSize?: string }) {
  return (
    <div className="flex items-center">
      <GlitchBox size={iconSize} />
      <div className="flex flex-col ml-2 mt-0.5">
        <span
          className="text-text-1"
          style={{
            fontFamily: "'Chakra Petch', sans-serif",
            fontSize,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          Vortix
        </span>
        <div className="h-[2px] w-full mt-1 relative overflow-hidden rounded-full bg-border/60">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-400/40 to-transparent" />
          <div className="absolute h-full w-8 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" style={{ animation: 'trackPulse 2.5s cubic-bezier(0.4,0,0.2,1) infinite' }} />
        </div>
      </div>
    </div>
  )
}
