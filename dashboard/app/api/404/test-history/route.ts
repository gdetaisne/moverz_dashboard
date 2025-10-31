import { NextRequest, NextResponse } from 'next/server'
import { bigquery } from '@/lib/bigquery'

const projectId = process.env.GCP_PROJECT_ID || 'moverz-dashboard'
const dataset = process.env.BQ_DATASET || 'analytics_core'

export const dynamic = 'force-dynamic'

/**
 * GET /api/404/test-history
 * Test complet pour diagnostiquer le problème d'historique
 */
export async function GET(_request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    projectId,
    dataset,
    table: `${projectId}.${dataset}.errors_404_history`,
    tests: {},
  }

  try {
    // TEST 1: Vérifier existence de la table
    try {
      const checkTable = `
        SELECT COUNT(*) as total
        FROM \`${projectId}.${dataset}.errors_404_history\`
      `
      const [rows] = await bigquery.query({ query: checkTable })
      results.tests.tableExists = true
      results.tests.totalRecords = rows[0]?.total || 0
    } catch (e: any) {
      results.tests.tableExists = false
      results.tests.tableError = e.message
      return NextResponse.json({ success: false, results }, { status: 500 })
    }

    // TEST 2: Lister les 5 derniers scans bruts
    try {
      const recentRaw = `
        SELECT 
          id,
          scan_date,
          TYPEOF(scan_date) as scan_date_type,
          total_sites,
          total_pages_checked,
          total_errors_404,
          TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), scan_date, DAY) as days_ago
        FROM \`${projectId}.${dataset}.errors_404_history\`
        ORDER BY scan_date DESC
        LIMIT 5
      `
      const [rows] = await bigquery.query({ query: recentRaw })
      results.tests.recentScansRaw = rows || []
    } catch (e: any) {
      results.tests.recentScansRawError = e.message
    }

    // TEST 3: Tester la requête getError404Evolution (mode evolution)
    try {
      const evolutionQuery = `
        SELECT 
          FORMAT_TIMESTAMP('%Y-%m-%dT00:00:00', TIMESTAMP(DATE(scan_date))) as date,
          COUNT(*) as nb_scans,
          CAST(AVG(total_pages_checked) AS INT64) as avg_pages_checked,
          CAST(AVG(total_errors_404) AS INT64) as avg_errors_404,
          CAST(MAX(total_errors_404) AS INT64) as max_errors_404,
          CAST(MIN(total_errors_404) AS INT64) as min_errors_404,
          CAST(AVG(crawl_duration_seconds) AS INT64) as avg_duration_seconds
        FROM \`${projectId}.${dataset}.errors_404_history\`
        WHERE scan_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        GROUP BY DATE(scan_date)
        ORDER BY date DESC
      `
      const [rows] = await bigquery.query({ query: evolutionQuery })
      results.tests.evolutionQuery = {
        success: true,
        rows: rows || [],
        count: rows?.length || 0,
        firstRow: rows?.[0] || null,
        allRows: rows || [],
      }
    } catch (e: any) {
      results.tests.evolutionQuery = {
        success: false,
        error: e.message,
        stack: e.stack,
      }
    }

    // TEST 4: Tester la requête getLastScansAsEvolution (mode last)
    try {
      const lastScansQuery = `
        SELECT 
          FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%S', scan_date) as date,
          1 as nb_scans,
          CAST(total_pages_checked AS INT64) as avg_pages_checked,
          CAST(total_errors_404 AS INT64) as avg_errors_404,
          CAST(total_errors_404 AS INT64) as max_errors_404,
          CAST(total_errors_404 AS INT64) as min_errors_404,
          CAST(crawl_duration_seconds AS INT64) as avg_duration_seconds
        FROM \`${projectId}.${dataset}.errors_404_history\`
        ORDER BY scan_date DESC
        LIMIT 20
      `
      const [rows] = await bigquery.query({ query: lastScansQuery })
      results.tests.lastScansQuery = {
        success: true,
        rows: rows || [],
        count: rows?.length || 0,
        firstRow: rows?.[0] || null,
        allRows: rows || [],
      }
    } catch (e: any) {
      results.tests.lastScansQuery = {
        success: false,
        error: e.message,
        stack: e.stack,
      }
    }

    // TEST 5: Tester getLastError404Scan
    try {
      const lastScanQuery = `
        SELECT 
          id,
          scan_date,
          total_sites,
          total_pages_checked,
          total_errors_404,
          sites_results,
          crawl_duration_seconds,
          created_at
        FROM \`${projectId}.${dataset}.errors_404_history\`
        WHERE scan_date = (
          SELECT MAX(scan_date) 
          FROM \`${projectId}.${dataset}.errors_404_history\`
        )
        LIMIT 1
      `
      const [rows] = await bigquery.query({ query: lastScanQuery })
      results.tests.lastScan = {
        success: true,
        exists: rows.length > 0,
        data: rows[0] || null,
      }
    } catch (e: any) {
      results.tests.lastScan = {
        success: false,
        error: e.message,
      }
    }

    // TEST 6: Vérifier le format des dates retournées
    if (results.tests.evolutionQuery?.success && results.tests.evolutionQuery.rows.length > 0) {
      const firstRow = results.tests.evolutionQuery.rows[0]
      results.tests.dateFormatCheck = {
        raw: firstRow.date,
        type: typeof firstRow.date,
        canParseISO: (() => {
          try {
            const d = new Date(firstRow.date)
            return !isNaN(d.getTime())
          } catch {
            return false
          }
        })(),
        parsed: (() => {
          try {
            return new Date(firstRow.date).toISOString()
          } catch {
            return null
          }
        })(),
      }
    }

    // TEST 7: Simuler l'appel API complet
    try {
      const { getError404Evolution, getLastScansAsEvolution } = await import('@/lib/bigquery')
      const evolution = await getError404Evolution(30)
      const lastScans = await getLastScansAsEvolution(20)
      
      results.tests.apiFunctions = {
        getError404Evolution: {
          success: true,
          count: evolution.length,
          first: evolution[0] || null,
          all: evolution,
        },
        getLastScansAsEvolution: {
          success: true,
          count: lastScans.length,
          first: lastScans[0] || null,
          all: lastScans,
        },
      }
    } catch (e: any) {
      results.tests.apiFunctions = {
        success: false,
        error: e.message,
        stack: e.stack,
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error: any) {
    console.error('[404/test-history] Error:', error)
    return NextResponse.json({
      success: false,
      results,
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}

