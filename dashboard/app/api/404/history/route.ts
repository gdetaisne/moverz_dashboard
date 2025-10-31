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
    
    console.log(`[404/history] Mode: ${mode}, Loaded ${evolution?.length || 0} evolution entries, lastScan: ${lastScan ? 'exists' : 'null'}`)
    if (evolution && evolution.length > 0) {
      console.log(`[404/history] First entry:`, JSON.stringify(evolution[0], null, 2))
      console.log(`[404/history] Last entry:`, JSON.stringify(evolution[evolution.length - 1], null, 2))
    }
    
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
    console.error('Stack:', error.stack)
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    
    // En production, retourner succès avec données vides pour éviter crash UI
    // En dev, retourner erreur pour faciliter le debug
    const sp = request.nextUrl.searchParams
    const days = parseInt(sp.get('days') || '30', 10)
    const mode = (sp.get('mode') || 'last').toLowerCase()
    
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        success: false,
        data: {
          evolution: [],
          lastScan: null,
        },
        meta: { days, count: 0, mode },
        error: error.message,
        stack: error.stack,
      }, { status: 500 })
    }
    
    // Production : masquer l'erreur pour l'UI
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

