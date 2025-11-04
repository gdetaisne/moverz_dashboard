import { NextRequest, NextResponse } from 'next/server'
import { getError404Evolution, getLastError404Scan, getLastScansAsEvolution, hasBigQueryCredentials } from '@/lib/bigquery'

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
    
    // Dev fallback: pas de credentials BQ → renvoyer 200 avec données vides
    if (!hasBigQueryCredentials()) {
      return NextResponse.json({
        success: true,
        data: { evolution: [], lastScan: null },
        meta: { days, count: 0, mode, credentials: 'missing' },
      })
    }

    // Mode par défaut demandé: derniers crawls (non agrégés)
    const evolution = mode === 'last'
      ? await getLastScansAsEvolution(count)
      : await getError404Evolution(days)
    
    // Récupérer le dernier scan
    const lastScan = await getLastError404Scan()
    
    console.log(`[404/history] Mode: ${mode}, Loaded ${evolution?.length || 0} evolution entries, lastScan: ${lastScan ? 'exists' : 'null'}`)
    console.log(`[404/history] Evolution type:`, typeof evolution, Array.isArray(evolution) ? 'array' : 'not array')
    if (evolution && evolution.length > 0) {
      console.log(`[404/history] First entry:`, JSON.stringify(evolution[0], null, 2))
      console.log(`[404/history] Last entry:`, JSON.stringify(evolution[evolution.length - 1], null, 2))
      console.log(`[404/history] All entries:`, JSON.stringify(evolution, null, 2))
    } else {
      console.warn(`[404/history] No evolution data returned!`, {
        evolution,
        evolutionType: typeof evolution,
        isArray: Array.isArray(evolution),
        mode,
        days,
        count,
      })
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
    console.error('[404/history] API error:', error)
    console.error('[404/history] Stack:', error.stack)
    console.error('[404/history] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    
    const sp = request.nextUrl.searchParams
    const days = parseInt(sp.get('days') || '30', 10)
    const mode = (sp.get('mode') || 'last').toLowerCase()
    
    // Ne pas planter l'UI: renvoyer 200 avec données vides et détails d'erreur
    return NextResponse.json({
      success: true,
      data: { evolution: [], lastScan: null },
      meta: { days, count: 0, mode },
      error: error.message,
      errorCode: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}

