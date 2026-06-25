// SVG icon set ported from the prototype's inline markup. Each icon keeps the
// exact viewBox/paths/stroke weights so geometry matches the design 1:1.
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function svgBase(size: number, rest: SVGProps<SVGSVGElement>) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    ...rest,
  }
}

export function GridIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}

export function GearIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function ChevronDown({ size = 13, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function ChevronLeft({ size = 15, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function ChevronRight({ size = 15, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

// Git-branch glyph (the slim "fork" used for repo · branch labels).
export function BranchIcon({ size = 13, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={1.8}>
      <path d="M6 3v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  )
}

export function BaseBranchIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={1.8}>
      <path d="M6 3v12" />
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
    </svg>
  )
}

export function ClockIcon({ size = 12, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function TreeIcon({ size = 17, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="12" r="2.4" />
      <path d="M6 8.4v7.2M8.4 6h4.8a3 3 0 0 1 3 3v.6M8.4 18h4.8a3 3 0 0 0 3-3v-.6" />
    </svg>
  )
}

export function PanelIcon({ size = 17, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </svg>
  )
}

export function CloseIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function MenuIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}

export function ArrowRight({ size = 15, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function CheckIcon({ size = 15, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function SparkleIcon({ size = 13, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.4 6.6L22 12l-6.6 2.4L13 21l-2.4-6.6L4 12l6.6-2.4z" />
    </svg>
  )
}

export function BoltIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="m13 2-3 9h5l-3 9" />
    </svg>
  )
}

export function QueueIcon({ size = 12, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={2}>
      <path d="M12 2v6M12 2L9 5M12 2l3 3" />
      <path d="M5 12h14a2 2 0 0 1 2 2v6H3v-6a2 2 0 0 1 2-2Z" />
    </svg>
  )
}

export function ShareIcon({ size = 13, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
      <path d="M16 6l-4-4-4 4M12 2v13" />
    </svg>
  )
}

export function RewindIcon({ size = 12, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
    </svg>
  )
}

export function BookmarkIcon({ size = 13, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#b9772a" stroke="none" {...p}>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  )
}

export function SpinnerIcon({ size = 13, ...p }: IconProps) {
  return (
    <svg
      {...svgBase(size, p)}
      stroke="#b9772a"
      strokeWidth={2.4}
      strokeLinecap="round"
      style={{ animation: 'pi-spin .8s linear infinite', flex: 'none', ...(p.style || {}) }}
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  )
}

// The π monogram tile used in the brand mark and the agent avatar.
export function PiMark({ tile = 30, font = 18, radius = 8 }: { tile?: number; font?: number; radius?: number }) {
  return (
    <div
      style={{
        width: tile,
        height: tile,
        borderRadius: radius,
        background: '#1b1b1d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono',monospace",
          color: '#f4f2ec',
          fontSize: font,
          fontWeight: 600,
          lineHeight: 1,
          marginTop: -1,
        }}
      >
        π
      </span>
    </div>
  )
}
