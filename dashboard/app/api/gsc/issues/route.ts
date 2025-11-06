import { NextRequest, NextResponse } from 'next/server'
import { getBigQueryClient, BQ_PROJECT_ID, BQ_DATASET } from '@/lib/bigquery'
import type { GSCIssue } from '@/lib/types/gsc'

const bigquery = getBigQueryClient()

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const domain = searchParams.get('domain')
  const severity = searchParams.get('severity')
  const status = searchParams.get('status') || 'open'
  const days = parseInt(searchParams.get('days') || '30', 10)

  try {
    let whereClause = `WHERE issue_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)`
    
    if (domain && domain !== 'all') {
      whereClause += ` AND domain = @domain`
    }
    if (severity && severity !== 'all') {
      whereClause += ` AND severity = @severity`
    }
    if (status && status !== 'all') {
      whereClause += ` AND status = @status`
    }

    const query = `
      SELECT 
        id,
        issue_date,
        domain,
        issue_type,
        severity,
        status,
        title,
        description,
        affected_pages_count,
        affected_urls,
        detected_at,
        first_seen,
        last_seen,
        resolved_at,
        gsc_notification_id,
        source
      FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.gsc_issues\`
      ${whereClause}
      ORDER BY 
        CASE severity 
          WHEN 'error' THEN 1 
          WHEN 'warning' THEN 2 
          ELSE 3 
        END,
        detected_at DESC
      LIMIT 200
    `

    const options: any = {
      query,
      location: process.env.BQ_LOCATION || 'europe-west1',
      params: {} as Record<string, any>,
    }

    if (domain && domain !== 'all') {
      options.params.domain = domain
    }
    if (severity && severity !== 'all') {
      options.params.severity = severity
    }
    if (status && status !== 'all') {
      options.params.status = status
    }

    const [rows] = await bigquery.query(options)

    // Parse JSON fields
    const issues: GSCIssue[] = rows.map((row: any) => ({
      ...row,
      affected_urls: row.affected_urls ? JSON.parse(row.affected_urls) : [],
      detected_at: row.detected_at?.value || row.detected_at,
      first_seen: row.first_seen?.value || row.first_seen,
      last_seen: row.last_seen?.value || row.last_seen,
      resolved_at: row.resolved_at?.value || row.resolved_at,
      issue_date: row.issue_date?.value || row.issue_date,
    }))

    // Stats
    const stats = {
      total: issues.length,
      by_severity: {
        error: issues.filter(i => i.severity === 'error').length,
        warning: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length,
      },
      by_status: {
        open: issues.filter(i => i.status === 'open').length,
        resolved: issues.filter(i => i.status === 'resolved').length,
        fixed: issues.filter(i => i.status === 'fixed').length,
      },
      by_type: {} as Record<string, number>,
    }

    issues.forEach(issue => {
      stats.by_type[issue.issue_type] = (stats.by_type[issue.issue_type] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      issues,
      stats,
      meta: { domain, severity, status, days },
    })
  } catch (error: any) {
    console.error('Error fetching GSC issues:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error fetching issues',
        error: error.message,
      },
      { status: 500 }
    )
  }
}

