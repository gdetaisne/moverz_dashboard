import { NextRequest, NextResponse } from 'next/server'
import { bigquery } from '@/lib/bigquery'

const projectId = process.env.GCP_PROJECT_ID || 'moverz-dashboard'
const dataset = process.env.BQ_DATASET || 'analytics_core'

export const dynamic = 'force-dynamic'

/**
 * GET /api/404/debug
 * Endpoint de diagnostic pour vérifier l'état de la table errors_404_history
 */
export async function GET(_request: NextRequest) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    projectId,
    dataset,
    table: `${projectId}.${dataset}.errors_404_history`,
    checks: {},
  }

  try {
    // 1. Vérifier l'existence et compter les enregistrements
    try {
      const countQuery = `
        SELECT COUNT(*) as total
        FROM \`${projectId}.${dataset}.errors_404_history\`
      `
      const [countRows] = await bigquery.query({ query: countQuery })
      diagnostics.checks.tableExists = true
      diagnostics.checks.totalRecords = countRows[0]?.total || 0
    } catch (e: any) {
      diagnostics.checks.tableExists = false
      diagnostics.checks.tableError = e.message
      return NextResponse.json({ success: false, diagnostics }, { status: 500 })
    }

    // 2. Vérifier les données récentes
    try {
      const recentQuery = `
        SELECT 
          id,
          scan_date,
          total_sites,
          total_pages_checked,
          total_errors_404,
          TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), scan_date, DAY) as days_ago
        FROM \`${projectId}.${dataset}.errors_404_history\`
        ORDER BY scan_date DESC
        LIMIT 5
      `
      const [recentRows] = await bigquery.query({ query: recentQuery })
      diagnostics.checks.recentScans = recentRows || []
    } catch (e: any) {
      diagnostics.checks.recentScansError = e.message
    }

    // 3. Vérifier le format de scan_date
    try {
      const typeQuery = `
        SELECT 
          scan_date,
          FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S', scan_date) as formatted_date
        FROM \`${projectId}.${dataset}.errors_404_history\`
        ORDER BY scan_date DESC
        LIMIT 1
      `
      const [typeRows] = await bigquery.query({ query: typeQuery })
      diagnostics.checks.scanDateSample = typeRows[0] || null
    } catch (e: any) {
      diagnostics.checks.scanDateError = e.message
    }

    // 4. Tester la requête d'évolution
    try {
      const evolutionQuery = `
        SELECT 
          FORMAT_TIMESTAMP('%Y-%m-%dT00:00:00', TIMESTAMP(DATE(scan_date))) as date,
          COUNT(*) as nb_scans,
          CAST(AVG(total_errors_404) AS INT64) as avg_errors_404
        FROM \`${projectId}.${dataset}.errors_404_history\`
        WHERE scan_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        GROUP BY DATE(scan_date)
        ORDER BY date DESC
        LIMIT 10
      `
      const [evolutionRows] = await bigquery.query({ query: evolutionQuery })
      diagnostics.checks.evolutionQuery = {
        success: true,
        rows: evolutionRows || [],
        count: evolutionRows?.length || 0,
      }
    } catch (e: any) {
      diagnostics.checks.evolutionQuery = {
        success: false,
        error: e.message,
        stack: e.stack,
      }
    }

    // 5. Vérifier les statistiques globales
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_scans,
          MIN(scan_date) as oldest_scan,
          MAX(scan_date) as newest_scan,
          SUM(total_errors_404) as total_errors_all_time
        FROM \`${projectId}.${dataset}.errors_404_history\`
      `
      const [statsRows] = await bigquery.query({ query: statsQuery })
      diagnostics.checks.globalStats = statsRows[0] || null
    } catch (e: any) {
      diagnostics.checks.globalStatsError = e.message
    }

    return NextResponse.json({
      success: true,
      diagnostics,
    })
  } catch (error: any) {
    console.error('[404/debug] Error:', error)
    return NextResponse.json({
      success: false,
      diagnostics,
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}

