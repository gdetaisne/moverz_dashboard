/**
 * ETL Web Vitals - Agrégation quotidienne
 */

import { query, insertRows } from '../shared/bigquery-client.js'
import { withErrorHandling, log } from '../shared/error-handler.js'
import type { WebVitalAggregate, ETLJobResult } from '../shared/types.js'

// ========================================
// AGGREGATION
// ========================================

/**
 * Agréger les Web Vitals bruts en métriques p50/p75/p95
 * 
 * Note: Les Web Vitals bruts sont collectés côté client
 * et insérés dans une table web_vitals_raw (non créée dans migration 001)
 * 
 * Pour Phase 1, on skip cette partie (sera implémenté en Phase 2)
 */
export async function runWebVitalsAggregator(date?: string): Promise<ETLJobResult> {
  const startedAt = new Date()
  const targetDate = date || getYesterday()
  
  log('info', 'Starting Web Vitals Aggregation', { targetDate })

  try {
    // TODO: Implémenter l'agrégation depuis web_vitals_raw
    // Pour l'instant, on retourne un résultat vide (Phase 1)
    
    log('info', 'Web Vitals aggregation skipped (Phase 1 - not implemented yet)')

    const completedAt = new Date()
    
    return {
      jobName: 'web-vitals-aggregate',
      startedAt,
      completedAt,
      status: 'success',
      rowsProcessed: 0,
      errors: [],
    }
  } catch (error: any) {
    log('error', 'Web Vitals aggregation failed', { error: error.message })
    
    const completedAt = new Date()
    
    return {
      jobName: 'web-vitals-aggregate',
      startedAt,
      completedAt,
      status: 'failed',
      rowsProcessed: 0,
      errors: [error.message],
    }
  }
}

// ========================================
// HELPERS
// ========================================

function getYesterday(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return date.toISOString().split('T')[0]
}

// ========================================
// EXÉCUTION CLI
// ========================================

if (import.meta.url === `file://${process.argv[1]}`) {
  withErrorHandling('web-vitals-aggregate', async () => {
    const result = await runWebVitalsAggregator()
    
    console.log('\n📊 Résultat:')
    console.log(`  Status: ${result.status}`)
    console.log(`  Rows: ${result.rowsProcessed}`)
    console.log(`  Duration: ${(result.completedAt.getTime() - result.startedAt.getTime()) / 1000}s`)

    process.exit(result.status === 'failed' ? 1 : 0)
  })
}

