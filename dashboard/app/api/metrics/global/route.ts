import { NextRequest, NextResponse } from 'next/server'
import { getGlobalMetrics } from '@/lib/bigquery'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '7', 10)
    
    const data = await getGlobalMetrics(days)
    
    return NextResponse.json({
      success: true,
      data,
      meta: {
        period: `${days} days`,
        count: data.length,
      }
    })
  } catch (error: any) {
    console.error('API /metrics/global error:', error)
    // Fallback doux pour éviter de casser l'UI en dev sans credentials BigQuery
    const days = parseInt(request.nextUrl.searchParams.get('days') || '7', 10)
    const sitesEnv = (process.env.SITES_LIST || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const dataFallback = sitesEnv.map((site) => ({
      site,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      trend_clicks: 0,
      trend_impressions: 0,
    }))
    return NextResponse.json({
      success: true,
      data: dataFallback,
      meta: { period: `${days} days`, count: dataFallback.length, fallback: 'bigquery_unavailable' }
    })
  }
}

