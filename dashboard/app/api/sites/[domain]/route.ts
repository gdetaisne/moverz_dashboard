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

const BQ_LOCATION = process.env.BQ_LOCATION || 'europe-west1'
const BQ_DATASET = process.env.BQ_DATASET || 'analytics_core'

export async function GET(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  const domain = params.domain
  const searchParams = request.nextUrl.searchParams
  const days = searchParams.get('days') || '30'

  try {
    // 1. Métriques globales + variation
    const summaryQuery = `
      WITH current_period AS (
        SELECT 
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          AVG(ctr) as avg_ctr,
          AVG(position) as avg_position
        FROM \`${BQ_DATASET}.gsc_daily_aggregated\`
        WHERE domain = @domain
          AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
      ),
      previous_period AS (
        SELECT 
          SUM(impressions) as total_impressions
        FROM \`${BQ_DATASET}.gsc_daily_aggregated\`
        WHERE domain = @domain
          AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${parseInt(days) * 2} DAY)
          AND date < DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
      )
      SELECT 
        c.*,
        SAFE_DIVIDE((c.total_impressions - p.total_impressions), p.total_impressions) * 100 as variation_7d
      FROM current_period c, previous_period p
    `

    const [summaryRows] = await bigquery.query({
      query: summaryQuery,
      location: BQ_LOCATION,
      params: { domain },
    })

    // 2. Série temporelle
    const timeseriesQuery = `
      SELECT 
        date,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        AVG(ctr) as ctr,
        AVG(position) as position
      FROM \`${BQ_DATASET}.gsc_daily_aggregated\`
      WHERE domain = @domain
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
      GROUP BY date
      ORDER BY date DESC
    `

    const [timeseriesRows] = await bigquery.query({
      query: timeseriesQuery,
      location: BQ_LOCATION,
      params: { domain },
    })

    // 3. Top Pages
    const topPagesQuery = `
      SELECT 
        page as url,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        AVG(ctr) as ctr,
        AVG(position) as position
      FROM \`${BQ_DATASET}.gsc_daily_metrics\`
      WHERE domain = @domain
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
      GROUP BY page
      ORDER BY clicks DESC
      LIMIT 50
    `

    const [topPagesRows] = await bigquery.query({
      query: topPagesQuery,
      location: BQ_LOCATION,
      params: { domain },
    })

    // 4. Top Queries
    const topQueriesQuery = `
      SELECT 
        query,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        AVG(ctr) as ctr,
        AVG(position) as position
      FROM \`${BQ_DATASET}.gsc_daily_metrics\`
      WHERE domain = @domain
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
      GROUP BY query
      ORDER BY impressions DESC
      LIMIT 100
    `

    const [topQueriesRows] = await bigquery.query({
      query: topQueriesQuery,
      location: BQ_LOCATION,
      params: { domain },
    })

    // 5. Insights récents pour ce site
    const insightsQuery = `
      SELECT 
        agent,
        title,
        summary,
        severity,
        score,
        payload,
        suggested_actions,
        created_at
      FROM \`${BQ_DATASET}.agent_insights\`
      WHERE site = @domain
        AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      ORDER BY created_at DESC
      LIMIT 10
    `

    const [insightsRows] = await bigquery.query({
      query: insightsQuery,
      location: BQ_LOCATION,
      params: { domain },
    })

    // Format response
    const response = {
      summary: summaryRows[0] || {
        total_impressions: 0,
        total_clicks: 0,
        avg_ctr: 0,
        avg_position: 0,
        variation_7d: 0,
      },
      timeseries: timeseriesRows.map((row: any) => ({
        date: row.date.value,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        position: row.position,
      })),
      top_pages: topPagesRows.map((row: any) => ({
        url: row.url,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        position: row.position,
      })),
      top_queries: topQueriesRows.map((row: any) => ({
        query: row.query,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        position: row.position,
      })),
      insights: insightsRows.map((row: any) => ({
        agent: row.agent,
        title: row.title,
        summary: row.summary,
        severity: row.severity,
        score: row.score,
        payload: row.payload ? JSON.parse(row.payload) : null,
        suggested_actions: row.suggested_actions ? JSON.parse(row.suggested_actions) : null,
        created_at: row.created_at.value,
        site: domain,
      })),
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error fetching site data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch site data', details: error.message },
      { status: 500 }
    )
  }
}

