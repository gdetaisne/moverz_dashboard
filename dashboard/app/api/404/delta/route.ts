import { NextRequest, NextResponse } from 'next/server'
import { getBrokenLinksDelta, getError404Delta } from '@/lib/bigquery'

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

    // Calculer les deux deltas (liens cassés visibles et URLs 404)
    const [brokenLinksDelta, urlsDelta] = await Promise.all([
      getBrokenLinksDelta({ from, to }),
      getError404Delta({ from, to }),
    ])

    if (!brokenLinksDelta && !urlsDelta) {
      return NextResponse.json({ success: false, message: 'Delta indisponible (pas assez de scans)' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        broken_links: brokenLinksDelta || null,
        urls_404: urlsDelta || null,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}


