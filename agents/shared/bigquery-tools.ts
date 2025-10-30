/**
 * Outils BigQuery pour les agents IA
 */

import { query } from '../../etl/shared/bigquery-client.js'
import type { BigQueryContext } from '../core/types.js'

// ========================================
// REQUÊTES SEO (GSC)
// ========================================

export async function getGSCSummary(context: BigQueryContext = {}) {
  const {
    site,
    startDate = '30 DAY',
    endDate = 'CURRENT_DATE()',
  } = context

  const siteFilter = site ? `AND site = '${site}'` : ''

  const sql = `
    SELECT 
      domain as site,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      AVG(ctr) as avg_ctr,
      AVG(position) as avg_position
    FROM \`analytics_core.gsc_daily_aggregated\`
    WHERE date >= DATE_SUB(${endDate}, INTERVAL ${startDate})
      ${siteFilter.replace('site', 'domain')}
    GROUP BY domain
    ORDER BY total_clicks DESC
  `

  return query(sql)
}

export async function getTopPages(context: BigQueryContext = {}) {
  const {
    site,
    limit = 20,
    startDate = '7 DAY',
  } = context

  const siteFilter = site ? `AND site = '${site}'` : ''

  const sql = `
    SELECT 
      domain as site,
      page as url,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      AVG(ctr) as avg_ctr,
      AVG(position) as avg_position
    FROM \`analytics_core.gsc_daily_metrics\`
    WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate})
      ${siteFilter.replace('site', 'domain')}
    GROUP BY domain, page
    ORDER BY total_clicks DESC
    LIMIT ${limit}
  `

  return query(sql)
}

export async function getLowCTRPages(context: BigQueryContext = {}) {
  const {
    site,
    limit = 10,
    startDate = '30 DAY',
  } = context

  const siteFilter = site ? `AND site = '${site}'` : ''

  const sql = `
    SELECT 
      domain as site,
      page as url,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      AVG(ctr) as avg_ctr,
      AVG(position) as avg_position
    FROM \`analytics_core.gsc_daily_metrics\`
    WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate})
      ${siteFilter.replace('site', 'domain')}
      AND impressions > 100
    GROUP BY domain, page
    HAVING avg_ctr < 0.02
    ORDER BY total_impressions DESC
    LIMIT ${limit}
  `

  return query(sql)
}

export async function getTopQueries(context: BigQueryContext = {}) {
  const {
    site,
    limit = 50,
    startDate = '30 DAY',
  } = context

  const siteFilter = site ? `AND site = '${site}'` : ''

  const sql = `
    SELECT 
      domain as site,
      query,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      AVG(ctr) as avg_ctr,
      AVG(position) as avg_position
    FROM \`analytics_core.gsc_daily_metrics\`
    WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate})
      ${siteFilter.replace('site', 'domain')}
    GROUP BY domain, query
    ORDER BY total_impressions DESC
    LIMIT ${limit}
  `

  return query(sql)
}

// ========================================
// REQUÊTES CONVERSIONS
// ========================================

export async function getConversionFunnel(context: BigQueryContext = {}) {
  const {
    site,
    startDate = '7 DAY',
  } = context

  const siteFilter = site ? `AND city = '${site}'` : ''

  const sql = `
    WITH funnel AS (
      SELECT
        city as site,
        COUNTIF(event_name = 'page_view') as page_views,
        COUNTIF(event_name = 'cta_click') as cta_clicks,
        COUNTIF(event_name = 'form_start') as form_starts,
        COUNTIF(event_name = 'form_submit') as form_submits
      FROM \`analytics_XXXXXX.events_*\`
      WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate}))
        ${siteFilter}
      GROUP BY city
    )
    SELECT 
      site,
      page_views,
      cta_clicks,
      form_starts,
      form_submits,
      SAFE_DIVIDE(cta_clicks, page_views) as cta_rate,
      SAFE_DIVIDE(form_starts, cta_clicks) as form_start_rate,
      SAFE_DIVIDE(form_submits, form_starts) as completion_rate,
      SAFE_DIVIDE(form_submits, page_views) as overall_conversion_rate
    FROM funnel
    ORDER BY form_submits DESC
  `

  // Note: Cette requête nécessite que GA4 soit configuré et exporte vers BigQuery
  // Pour Phase 1, elle retournera une erreur (table n'existe pas encore)
  try {
    return await query(sql)
  } catch {
    return []
  }
}

// ========================================
// REQUÊTES TENDANCES
// ========================================

export async function getVisibilityTrends(context: BigQueryContext = {}) {
  const {
    site,
    startDate = '30 DAY',
  } = context

  const siteFilter = site ? `AND site = '${site}'` : ''

  const sql = `
    WITH daily AS (
      SELECT 
        domain as site,
        date,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks
      FROM \`analytics_core.gsc_daily_aggregated\`
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate})
        ${siteFilter.replace('site', 'domain')}
      GROUP BY domain, date
      ORDER BY domain, date
    ),
    with_prev AS (
      SELECT 
        *,
        LAG(impressions, 7) OVER (PARTITION BY site ORDER BY date) as impressions_prev_week,
        LAG(clicks, 7) OVER (PARTITION BY site ORDER BY date) as clicks_prev_week
      FROM daily
    )
    SELECT 
      site,
      date,
      impressions,
      clicks,
      impressions_prev_week,
      clicks_prev_week,
      SAFE_DIVIDE(impressions - impressions_prev_week, impressions_prev_week) as impressions_change,
      SAFE_DIVIDE(clicks - clicks_prev_week, clicks_prev_week) as clicks_change
    FROM with_prev
    WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
    ORDER BY site, date DESC
  `

  return query(sql)
}

export async function getTrafficComparison(context: BigQueryContext = {}) {
  const {
    site,
    startDate = '30 DAY',
  } = context

  const siteFilter = site ? `AND site = '${site}'` : ''

  const sql = `
    WITH periods AS (
      SELECT 
        domain as site,
        CASE 
          WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN 'last_7d'
          WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN 'prev_7d'
          ELSE 'older'
        END as period,
        impressions,
        clicks,
        ctr,
        position
      FROM \`analytics_core.gsc_daily_aggregated\`
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate})
        ${siteFilter.replace('site', 'domain')}
    )
    SELECT 
      site,
      period,
      COUNT(*) as days,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      AVG(ctr) as avg_ctr,
      AVG(position) as avg_position
    FROM periods
    WHERE period IN ('last_7d', 'prev_7d')
    GROUP BY site, period
    ORDER BY site, period
  `

  return query(sql)
}

// ========================================
// REQUÊTES CONTENT GAPS
// ========================================

export async function getContentGaps(context: BigQueryContext = {}) {
  const {
    site,
    limit = 20,
    startDate = '30 DAY',
  } = context

  const siteFilter = site ? `AND site = '${site}'` : ''

  const sql = `
    SELECT 
      domain as site,
      query,
      SUM(impressions) as total_impressions,
      AVG(position) as avg_position
    FROM \`analytics_core.gsc_daily_metrics\`
    WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate})
      ${siteFilter.replace('site', 'domain')}
      AND position > 10
      AND impressions > 50
    GROUP BY domain, query
    ORDER BY total_impressions DESC
    LIMIT ${limit}
  `

  return query(sql)
}

export async function getUnderperformingContent(context: BigQueryContext = {}) {
  const {
    site,
    limit = 15,
    startDate = '30 DAY',
  } = context

  const siteFilter = site ? `AND site = '${site}'` : ''

  const sql = `
    SELECT 
      domain as site,
      page as url,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      AVG(ctr) as avg_ctr,
      AVG(position) as avg_position
    FROM \`analytics_core.gsc_daily_metrics\`
    WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate})
      ${siteFilter.replace('site', 'domain')}
      AND impressions > 100
    GROUP BY domain, page
    HAVING avg_ctr < 0.015 OR avg_position > 20
    ORDER BY total_impressions DESC
    LIMIT ${limit}
  `

  return query(sql)
}

// ========================================
// REQUÊTES CONVERSIONS & WEB VITALS
// ========================================

export async function getWebVitalsPerformance(context: BigQueryContext = {}) {
  const {
    site,
    startDate = '30 DAY',
  } = context

  const siteFilter = site ? `AND site = '${site}'` : ''

  const sql = `
    SELECT 
      site,
      AVG(lcp) as avg_lcp,
      AVG(fid) as avg_fid,
      AVG(cls) as avg_cls,
      COUNT(*) as sample_size
    FROM \`analytics_core.web_vitals\`
    WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate})
      ${siteFilter}
    GROUP BY site
    ORDER BY avg_lcp DESC
  `

  try {
    return await query(sql)
  } catch {
    return []
  }
}

// ========================================
// EXPORTS
// ========================================

export const bigqueryTools = {
  getGSCSummary,
  getTopPages,
  getLowCTRPages,
  getTopQueries,
  getConversionFunnel,
  getVisibilityTrends,
  getTrafficComparison,
  getContentGaps,
  getUnderperformingContent,
  getWebVitalsPerformance,
}

export default bigqueryTools

