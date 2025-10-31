import { NextRequest, NextResponse } from 'next/server'
import { getLastReconstructedScan } from '@/lib/bigquery'

export const dynamic = 'force-dynamic'

/**
 * GET /api/404/last
 * Retourne le dernier scan reconstruit (par site) avec liens cassés visibles.
 */
export async function GET(_request: NextRequest) {
  try {
    const payload = await getLastReconstructedScan()
    if (!payload) {
      // Retourner succès avec données vides plutôt qu'erreur 404
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Aucun scan disponible. Lancez un scan pour commencer.',
      })
    }
    return NextResponse.json({ success: true, data: payload })
  } catch (e: any) {
    console.error('[404/last] Error:', e)
    // Retourner succès avec données vides pour éviter crash UI
    return NextResponse.json({
      success: true,
      data: null,
      message: e.message || 'Erreur lors de la récupération du dernier scan',
    })
  }
}


