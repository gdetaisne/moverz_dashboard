import { NextRequest, NextResponse } from 'next/server'
import { getBrokenLinksDelta, getError404Delta } from '@/lib/json-storage'

export const dynamic = 'force-dynamic'

/**
 * GET /api/404/delta?from=<scanId>&to=<scanId>
 * Si "to" est omis, prend le dernier scan. Si "from" est omis, prend le précédent.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined

    // Priorité: delta sur les liens cassés visibles; fallback: URLs 404
    const brokenLinksDelta = await getBrokenLinksDelta({ from, to })
    if (brokenLinksDelta) {
      return NextResponse.json({ success: true, mode: 'broken_links', data: brokenLinksDelta })
    }
    const urlDelta = await getError404Delta({ from, to })
    if (urlDelta) {
      return NextResponse.json({ success: true, mode: 'urls_404', data: urlDelta })
    }
    return NextResponse.json({ success: false, message: 'Delta indisponible (pas assez de scans)' }, { status: 404 })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}


