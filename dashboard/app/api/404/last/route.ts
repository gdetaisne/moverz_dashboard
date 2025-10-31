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
      return NextResponse.json({ success: false, message: 'Aucun scan disponible' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: payload })
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 })
  }
}


