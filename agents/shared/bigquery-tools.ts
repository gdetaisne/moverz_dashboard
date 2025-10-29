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
      site,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      AVG(ctr) as avg_ctr,
      AVG(position) as avg_position
    FROM \`moverz.gsc_global\`
    WHERE date >= DATE_SUB(${endDate}, INTERVAL ${startDate})
      ${siteFilter}
    GROUP BY site
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
      site,
      url,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      AVG(ctr) as avg_ctr,
      AVG(position) as avg_position
    FROM \`moverz.gsc_pages\`
    WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate})
      ${siteFilter}
    GROUP BY site, url
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
      site,
      url,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      AVG(ctr) as avg_ctr,
      AVG(position) as avg_position
    FROM \`moverz.gsc_pages\`
    WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate})
      ${siteFilter}
      AND impressions > 100
    GROUP BY site, url
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
      site,
      query,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      AVG(ctr) as avg_ctr,
      AVG(position) as avg_position
    FROM \`moverz.gsc_queries\`
    WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate})
      ${siteFilter}
    GROUP BY site, query
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
        site,
        date,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks
      FROM \`moverz.gsc_global\`
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${startDate})
        ${siteFilter}
      GROUP BY site, date
      ORDER BY site, date
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
}

export default bigqueryTools

