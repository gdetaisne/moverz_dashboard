import { NextRequest, NextResponse } from 'next/server'
import { getTimeSeriesData } from '@/lib/bigquery'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const site = searchParams.get('site') || undefined
    const days = parseInt(searchParams.get('days') || '30', 10)
    
    const data = await getTimeSeriesData(site, days)
    
    return NextResponse.json({
      success: true,
      data,
      meta: {
        site: site || 'all',
        period: `${days} days`,
        count: data.length,
      }
    })
  } catch (error: any) {
    console.error('API /metrics/timeseries error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

