import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/404/scan
 * Scanner de 404 : vérifie les pages principales de chaque site
 */

const SITES = [
  'devis-demenageur-marseille.fr',
  'devis-demenageur-strasbourg.fr',
  'devis-demenageur-lille.fr',
  'devis-demenageur-rennes.fr',
  'devis-demenageur-rouen.fr',
  'devis-demenageur-nice.fr',
  'devis-demenageur-nantes.fr',
  'devis-demenageur-toulousain.fr',
  'devis-demenageur-lyon.fr',
  'www.bordeaux-demenageur.fr',
  'devis-demenageur-montpellier.fr',
]

// Normaliser l'URL du site (ajouter www si nécessaire)
function normalizeSiteUrl(site: string): string {
  if (site === 'bordeaux-demenageur.fr') {
    return 'www.bordeaux-demenageur.fr'
  }
  return site
}

// Pages à tester sur chaque site
const TEST_PATHS = [
  '/',
  '/blog',
  '/devis',
  '/contact',
  '/mentions-legales',
  '/politique-confidentialite',
  '/sitemap.xml',
]

interface ScanResult {
  site: string
  total_checked: number
  errors_404: number
  errors_list: string[]
  scan_date: string
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Démarrage du scan 404 sur', SITES.length, 'sites...')
    
    const results: ScanResult[] = []
    
    for (const site of SITES) {
      const errors: string[] = []
      
      for (const path of TEST_PATHS) {
        const url = `https://${site}${path}`
        
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            redirect: 'follow',
            signal: AbortSignal.timeout(5000), // 5s timeout
          })
          
          if (response.status === 404) {
            errors.push(path)
          }
        } catch (error: any) {
          // Timeout ou erreur réseau : on ignore
          console.warn(`Erreur fetch ${url}:`, error.message)
        }
      }
      
      results.push({
        site,
        total_checked: TEST_PATHS.length,
        errors_404: errors.length,
        errors_list: errors,
        scan_date: new Date().toISOString(),
      })
    }
    
    console.log('✅ Scan terminé:', results.length, 'sites analysés')
    
    return NextResponse.json({
      success: true,
      data: results,
      summary: {
        total_sites: results.length,
        total_checked: results.reduce((sum, r) => sum + r.total_checked, 0),
        total_errors: results.reduce((sum, r) => sum + r.errors_404, 0),
      },
      timestamp: new Date().toISOString(),
    })
    
  } catch (error: any) {
    console.error('❌ Erreur lors du scan 404:', error)
    
    return NextResponse.json(
      {
        success: false,
        message: 'Erreur lors du scan',
        error: error.message,
      },
      { status: 500 }
    )
  }
}

