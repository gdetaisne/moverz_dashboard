import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getError404Evolution, getLastError404Scan, getLastScansAsEvolution, hasBigQueryCredentials } from '@/lib/bigquery'
import { validateQuery, handleZodError } from '@/lib/api-helpers'
import type { ApiSuccessResponse } from '@/lib/api-helpers'
import { error404HistoryQuerySchema } from '@/lib/schemas/api'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/404/history
 * Récupère l'historique des erreurs 404
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ Validation Zod : days (1-365), count (1-100), mode ('last' | 'evolution')
    const params = validateQuery(request.nextUrl.searchParams, error404HistoryQuerySchema)
    
    // Dev fallback: pas de credentials BQ → renvoyer 200 avec données vides
    if (!hasBigQueryCredentials()) {
      const response: ApiSuccessResponse = {
        success: true,
        data: { evolution: [], lastScan: null },
        meta: { days: params.days, count: 0, mode: params.mode, credentials: 'missing' },
      }
      return NextResponse.json(response)
    }

    // Mode par défaut demandé: derniers crawls (non agrégés)
    const evolution = params.mode === 'last'
      ? await getLastScansAsEvolution(params.count)
      : await getError404Evolution(params.days)
    
    // Récupérer le dernier scan
    const lastScan = await getLastError404Scan()
    
    logger.debug('[404/history] Data loaded', {
      mode: params.mode,
      evolutionCount: evolution?.length || 0,
      hasLastScan: !!lastScan,
    })
    
    const response: ApiSuccessResponse = {
      success: true,
      data: {
        evolution: evolution || [],
        lastScan: lastScan || null,
      },
      meta: { days: params.days, count: evolution?.length || 0, mode: params.mode }
    }
    return NextResponse.json(response)
  } catch (error) {
    // Si erreur Zod (validation échouée), retourner 400 avec détails
    if (error instanceof z.ZodError) {
      return handleZodError(error)
    }
    
    logger.error('[404/history] API error', error, { route: '/api/404/history' })
    
    // Ne pas planter l'UI: renvoyer 200 avec données vides et détails d'erreur
    const fallbackResponse: ApiSuccessResponse = {
      success: true,
      data: { evolution: [], lastScan: null },
      meta: { days: 30, count: 0, mode: 'last' },
    }
    return NextResponse.json(fallbackResponse)
  }
}

