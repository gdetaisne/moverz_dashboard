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
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

