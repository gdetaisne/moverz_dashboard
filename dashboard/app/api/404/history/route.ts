import { NextRequest, NextResponse } from 'next/server'
import { getError404Evolution, getLastError404Scan, getLastScansAsEvolution } from '@/lib/bigquery'

export const dynamic = 'force-dynamic'

/**
 * GET /api/404/history
 * Récupère l'historique des erreurs 404
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30', 10)
    const count = parseInt(searchParams.get('count') || '20', 10)
    const mode = (searchParams.get('mode') || 'last').toLowerCase()
    
    // Mode par défaut demandé: derniers crawls (non agrégés)
    const evolution = mode === 'last'
      ? await getLastScansAsEvolution(count)
      : await getError404Evolution(days)
    
    // Récupérer le dernier scan
    const lastScan = await getLastError404Scan()
    
    console.log(`[404/history] Loaded ${evolution?.length || 0} evolution entries, lastScan: ${lastScan ? 'exists' : 'null'}`)
    
    return NextResponse.json({
      success: true,
      data: {
        evolution: evolution || [],
        lastScan: lastScan || null,
      },
      meta: { days, count: evolution?.length || 0, mode }
    })
  } catch (error: any) {
    console.error('API /404/history error:', error)
    // Log plus détaillé pour debug
    console.error('Full error:', JSON.stringify(error, null, 2))
    
    // Retourner un succès avec données vides pour éviter crash UI
    // Le frontend affichera le message "Aucune donnée historique disponible"
    const sp = request.nextUrl.searchParams
    const days = parseInt(sp.get('days') || '30', 10)
    const mode = (sp.get('mode') || 'last').toLowerCase()
    return NextResponse.json({
      success: true,
      data: {
        evolution: [],
        lastScan: null,
      },
      meta: { days, count: 0, mode },
      error: error.message,
    })
  }
}

