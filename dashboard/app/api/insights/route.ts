import { NextRequest, NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

// Configuration BigQuery avec support GCP_SA_KEY_JSON ou GOOGLE_APPLICATION_CREDENTIALS
function getBigQueryClient() {
  const projectId = process.env.GCP_PROJECT_ID || 'moverz-dashboard'
  
  // Si GCP_SA_KEY_JSON est fourni (comme dans CapRover), l'utiliser
  if (process.env.GCP_SA_KEY_JSON) {
    try {
      const credentials = JSON.parse(process.env.GCP_SA_KEY_JSON)
      return new BigQuery({
        projectId,
        credentials,
      })
    } catch (error) {
      console.error('Error parsing GCP_SA_KEY_JSON:', error)
    }
  }
  
  // Sinon utiliser GOOGLE_APPLICATION_CREDENTIALS (fichier)
  return new BigQuery({
    projectId,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  })
}

const bigquery = getBigQueryClient()

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const agent = searchParams.get('agent')
  const site = searchParams.get('site')
  const severity = searchParams.get('severity')
  const days = searchParams.get('days') || '30'
  const limit = parseInt(searchParams.get('limit') || '50', 10)

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
      LIMIT ${limit}
    `

    const [rows] = await bigquery.query({
      query,
      location: process.env.BQ_LOCATION || 'europe-west1',
    })

    // Parse JSON fields
    const insights = rows.map((row: any) => {
      const parseJson = (value: any) => {
        if (!value) return null
        if (typeof value === 'string') {
          try {
            return JSON.parse(value)
          } catch {
            return value
          }
        }
        return value
      }

      return {
        ...row,
        payload: parseJson(row.payload),
        evidence: parseJson(row.evidence),
        suggested_actions: parseJson(row.suggested_actions),
        created_at: row.created_at?.value || row.created_at,
        run_date: row.run_date?.value || row.run_date,
      }
    })

    return NextResponse.json({ insights })
  } catch (error: any) {
    console.error('Error fetching insights:', error)
    return NextResponse.json(
      { error: 'Failed to fetch insights', details: error.message },
      { status: 500 }
    )
  }
}

