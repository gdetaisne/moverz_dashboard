'use client'

import { useEffect } from 'react'

/**
 * Composant qui anime le favicon en générant plusieurs frames de rotation
 */
export function AnimatedFavicon() {
  useEffect(() => {
    // Nombre de frames pour une rotation fluide (plus il y en a, plus c'est fluide mais plus de requêtes)
    const frames = 12 // 12 frames = 30 degrés par frame
    const frameDuration = 100 // 100ms par frame = rotation complète en 1.2s
    
    let currentFrame = 0
    let faviconLink: HTMLLinkElement | null = null
    
    // Trouver ou créer l'élément link du favicon
    const findOrCreateFaviconLink = (): HTMLLinkElement => {
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      return link
    }
    
    // Générer un SVG avec rotation pour une frame donnée
    const generateFaviconSVG = (angle: number): string => {
      const centerX = 16
      const centerY = 16
      const size = 10
      const rad = (angle * Math.PI) / 180
      
      // Points du triangle équilatéral
      const points = [
        { x: centerX, y: centerY - size },
        { x: centerX - size * 0.866, y: centerY + size * 0.5 },
        { x: centerX + size * 0.866, y: centerY + size * 0.5 },
      ]
      
      // Rotation des points
      const rotatedPoints = points.map(p => {
        const dx = p.x - centerX
        const dy = p.y - centerY
        const x = dx * Math.cos(rad) - dy * Math.sin(rad) + centerX
        const y = dx * Math.sin(rad) + dy * Math.cos(rad) + centerY
        return { x, y }
      })
      
      const pathData = `M ${rotatedPoints[0].x} ${rotatedPoints[0].y} L ${rotatedPoints[1].x} ${rotatedPoints[1].y} L ${rotatedPoints[2].x} ${rotatedPoints[2].y} Z`
      
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <path
            d="${pathData}"
            fill="white"
            stroke="#f97316"
            stroke-width="2.5"
          />
          <line
            x1="${centerX}"
            y1="${centerY - 2}"
            x2="${centerX}"
            y2="${centerY + 2}"
            stroke="#f97316"
            stroke-width="2.5"
            stroke-linecap="round"
          />
          <circle
            cx="${centerX}"
            cy="${centerY + 4}"
            r="1"
            fill="#f97316"
          />
        </svg>
      `.trim()
      
      return `data:image/svg+xml,${encodeURIComponent(svg)}`
    }
    
    // Animation loop
    const animate = () => {
      const angle = (currentFrame * 360) / frames
      const svgDataUri = generateFaviconSVG(angle)
      
      faviconLink = findOrCreateFaviconLink()
      faviconLink.href = svgDataUri
      
      currentFrame = (currentFrame + 1) % frames
    }
    
    // Démarrer l'animation
    const interval = setInterval(animate, frameDuration)
    animate() // Appel immédiat pour première frame
    
    // Cleanup
    return () => {
      clearInterval(interval)
    }
  }, [])
  
  return null // Ce composant ne rend rien dans le DOM
}

