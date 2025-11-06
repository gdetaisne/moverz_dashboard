/**
 * Schémas Zod pour validation des API Routes
 * 
 * Ces schémas sont réutilisables dans toutes les routes pour garantir
 * que les données d'entrée sont valides et typées.
 */

import { z } from 'zod'

// ========================================
// SCHÉMAS RÉUTILISABLES
// ========================================

/**
 * Paramètres communs à beaucoup de routes
 */
export const commonQuerySchema = {
  days: z.coerce.number().int().min(1).max(365).default(7),
  site: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
}

/**
 * Pagination standard
 */
export const paginationSchema = {
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  count: z.coerce.number().int().min(1).max(100).default(20),
}

/**
 * Filtres de date
 */
export const dateFilterSchema = {
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}

// ========================================
// SCHÉMAS SPÉCIFIQUES PAR ROUTE
// ========================================

/**
 * GET /api/metrics/global
 */
export const metricsGlobalQuerySchema = z.object({
  days: commonQuerySchema.days,
})

/**
 * GET /api/metrics/timeseries
 */
export const metricsTimeseriesQuerySchema = z.object({
  days: commonQuerySchema.days,
  site: commonQuerySchema.site,
})

/**
 * GET /api/404/history
 */
export const error404HistoryQuerySchema = z.object({
  days: commonQuerySchema.days,
  count: paginationSchema.count,
  mode: z.enum(['last', 'evolution'], {
    errorMap: () => ({ message: "Mode must be 'last' or 'evolution'" })
  }).default('last'),
})

/**
 * GET /api/serp/preview
 */
export const serpPreviewQuerySchema = z.object({
  site: commonQuerySchema.site,
  limit: z.coerce.number().int().min(0).max(10000).default(20), // 0 = pas de limite
})

/**
 * GET /api/serp/audit
 */
export const serpAuditQuerySchema = z.object({
  site: commonQuerySchema.site,
  limit: z.coerce.number().int().min(1).max(10000).default(20),
})

/**
 * GET /api/gsc/issues
 */
export const gscIssuesQuerySchema = z.object({
  days: commonQuerySchema.days,
  domain: commonQuerySchema.domain,
  severity: z.enum(['all', 'error', 'warning', 'info']).default('all'),
  status: z.enum(['all', 'open', 'resolved', 'fixed']).default('all'),
})

/**
 * GET /api/metrics/pages
 * Note: limit peut être 0 pour "tous" (supporté par getTopPages)
 */
export const metricsPagesQuerySchema = z.object({
  site: commonQuerySchema.site,
  limit: z.coerce.number().int().min(0).max(10000).default(20),
})

/**
 * GET /api/metrics/queries
 */
export const metricsQueriesQuerySchema = z.object({
  site: commonQuerySchema.site,
  limit: paginationSchema.limit,
})

/**
 * GET /api/insights
 */
export const insightsQuerySchema = z.object({
  site: z.string().min(1).optional(),
  agent: z.string().min(1).optional(),
})

/**
 * POST /api/chat
 */
export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message requis'),
  mode: z.enum(['summary', 'detail', 'deepsearch', 'data']).default('summary'),
  context: z.record(z.unknown()).optional(),
  dataMode: z.boolean().optional(),
})

/**
 * POST /api/404/crawl
 */
export const crawl404RequestSchema = z.object({
  site: z.string().min(1).optional(),
  force: z.boolean().default(false),
})

/**
 * POST /api/404/analyze
 */
export const analyze404RequestSchema = z.object({
  results: z.array(z.object({
    site: z.string(),
    total_checked: z.number().int().min(0),
    errors_404: z.number().int().min(0),
    errors_list: z.array(z.string()),
    broken_links: z.number().int().min(0).optional(),
    broken_links_list: z.array(z.object({
      source: z.string(),
      target: z.string(),
    })).optional(),
  })).min(1, 'Au moins un résultat requis'),
})

