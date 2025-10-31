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
      getBrokenLinksDelta({ from, to }).catch(err => {
        console.error('[404/delta] Error fetching broken links delta:', err)
        return null
      }),
      getError404Delta({ from, to }).catch(err => {
        console.error('[404/delta] Error fetching 404 delta:', err)
        return null
      }),
    ])

    if (!brokenLinksDelta && !urlsDelta) {
      // Retourner succès avec données vides plutôt qu'erreur 404
      return NextResponse.json({
        success: true,
        data: {
          broken_links: null,
          urls_404: null,
        },
        message: 'Delta indisponible (pas assez de scans - minimum 2 scans requis)',
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        broken_links: brokenLinksDelta || null,
        urls_404: urlsDelta || null,
      },
    })
  } catch (error: any) {
    console.error('[404/delta] Unexpected error:', error)
    // Retourner succès avec données vides pour éviter crash UI
    return NextResponse.json({
      success: true,
      data: {
        broken_links: null,
        urls_404: null,
      },
      message: error.message || 'Erreur lors du calcul du delta',
    })
  }
}


