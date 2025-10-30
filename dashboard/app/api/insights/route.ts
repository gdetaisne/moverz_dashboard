import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID || 'moverz-dashboard',
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
})

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const agent = searchParams.get('agent')
  const site = searchParams.get('site')
  const severity = searchParams.get('severity')
  const days = searchParams.get('days') || '30'

  try {
    let whereClause = `WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${days} DAY)`
    
    if (agent && agent !== 'all') {
      whereClause += ` AND agent = '${agent}'`
    }
    if (site) {
      whereClause += ` AND site = '${site}'`
    }
    if (severity) {
      whereClause += ` AND severity = '${severity}'`
    }

    const query = `
      SELECT 
        id,
        run_date,
        site,
        agent,
        severity,
        title,
        summary,
        score,
        created_at,
        payload,
        evidence,
        suggested_actions
      FROM \`${process.env.GCP_PROJECT_ID}.${process.env.BQ_DATASET || 'analytics_core'}.agent_insights\`
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 50
    `

    const [rows] = await bigquery.query({
      query,
      location: process.env.BQ_LOCATION || 'europe-west1',
    })

    // Parse JSON fields
    const insights = rows.map((row: any) => ({
      ...row,
      payload: row.payload ? JSON.parse(row.payload) : null,
      evidence: row.evidence ? JSON.parse(row.evidence) : null,
      suggested_actions: row.suggested_actions ? JSON.parse(row.suggested_actions) : null,
      created_at: row.created_at.value,
      run_date: row.run_date.value,
    }))

    return NextResponse.json({ insights })
  } catch (error: any) {
    console.error('Error fetching insights:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insights', details: error.message },
      { status: 500 }
    )
  }
}

