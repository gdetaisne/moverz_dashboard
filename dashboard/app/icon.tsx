import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
  // Pour un favicon animé, on génère une frame statique (frame 0)
  // L'animation sera gérée par un composant client qui change le favicon
  const centerX = 16
  const centerY = 16
  const triangleSize = 10
  
  // Triangle équilatéral (angle 0 = pointe vers le haut)
  const pathData = `M ${centerX},${centerY - triangleSize} L ${centerX - triangleSize * 0.866},${centerY + triangleSize * 0.5} L ${centerX + triangleSize * 0.866},${centerY + triangleSize * 0.5} Z`
  
  return new ImageResponse(
    (
      <div
        style={{
          background: 'transparent',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
        >
          {/* Triangle orange avec bordure */}
          <path
            d={pathData}
            fill="white"
            stroke="#f97316"
            strokeWidth="2.5"
          />
          {/* Point d'exclamation orange */}
          <line
            x1={centerX}
            y1={centerY - 2}
            x2={centerX}
            y2={centerY + 2}
            stroke="#f97316"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle
            cx={centerX}
            cy={centerY + 4}
            r="1"
            fill="#f97316"
          />
        </svg>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
    }
  )
}
