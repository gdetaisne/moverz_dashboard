import { NextRequest, NextResponse } from 'next/server'
import { getTopQueries } from '@/lib/bigquery'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const site = searchParams.get('site') || undefined
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    
    const data = await getTopQueries(site, limit)
    
    return NextResponse.json({
      success: true,
      data,
      meta: {
        site: site || 'all',
        limit,
        count: data.length,
      }
    })
  } catch (error: any) {
    console.error('API /metrics/queries error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

