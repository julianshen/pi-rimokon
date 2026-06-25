import { useState } from 'react'

// Round profile avatar: shows the Google picture when available, falling back to
// the user's initials on a warm tile (also used if the image fails to load).
export function Avatar({ url, initials, size = 32 }: { url: string | null; initials: string; size?: number }) {
  const [broken, setBroken] = useState(false)

  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flex: 'none',
    objectFit: 'cover',
  }

  if (url && !broken) {
    return <img src={url} alt={initials} referrerPolicy="no-referrer" onError={() => setBroken(true)} style={base} />
  }

  return (
    <div
      style={{
        ...base,
        background: '#cdc8ba',
        color: '#5c594f',
        fontSize: Math.round(size * 0.38),
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {initials}
    </div>
  )
}
