import { NextRequest, NextResponse } from 'next/server'
import { getError404Evolution, getLastError404Scan } from '@/lib/bigquery'

export const dynamic = 'force-dynamic'

/**
 * GET /api/404/history
 * Récupère l'historique des erreurs 404
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30', 10)
    
    // Récupérer l'évolution temporelle
    const evolution = await getError404Evolution(days)
    
    // Récupérer le dernier scan
    const lastScan = await getLastError404Scan()
    
    return NextResponse.json({
      success: true,
      data: {
        evolution,
        lastScan,
      },
      meta: {
        days,
        count: evolution.length,
      }
    })
  } catch (error: any) {
    console.error('API /404/history error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

