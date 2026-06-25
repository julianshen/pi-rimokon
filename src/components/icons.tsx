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

// "Log out" glyph (door + arrow) for the profile footer / account card.
export function LogoutIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}

// GitHub's "Octocat" mark for the sign-in button — a single filled glyph that
// inherits the button's text color.
export function GitHubIcon({ size = 18, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 .5C5.37.5 0 5.78 0 12.292c0 5.211 3.438 9.63 8.205 11.188.6.111.82-.254.82-.567 0-.28-.01-1.022-.015-2.005-3.338.711-4.042-1.582-4.042-1.582-.546-1.361-1.335-1.725-1.335-1.725-1.087-.731.084-.716.084-.716 1.205.082 1.838 1.215 1.838 1.215 1.07 1.803 2.809 1.282 3.495.981.108-.763.417-1.282.76-1.577-2.665-.295-5.466-1.309-5.466-5.827 0-1.287.465-2.339 1.235-3.164-.135-.298-.54-1.497.105-3.121 0 0 1.005-.316 3.3 1.209a11.5 11.5 0 0 1 3-.398c1.02.006 2.04.136 3 .398 2.28-1.525 3.285-1.209 3.285-1.209.645 1.624.24 2.823.12 3.121.765.825 1.23 1.877 1.23 3.164 0 4.53-2.805 5.527-5.475 5.817.42.354.81 1.077.81 2.182 0 1.578-.015 2.846-.015 3.229 0 .309.21.678.825.561C20.565 21.917 24 17.495 24 12.292 24 5.78 18.63.5 12 .5z" />
    </svg>
  )
}

export function MoonIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

export function SunIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...svgBase(size, p)} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
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
        background: 'var(--pi-logo-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono',monospace",
          color: 'var(--pi-logo-fg)',
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
