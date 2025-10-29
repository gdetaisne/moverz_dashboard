/**
 * Client BigQuery centralisé
 */

import { BigQuery } from '@google-cloud/bigquery'
import type { ETLJobResult } from './types.js'

// Configuration
const projectId = process.env.GCP_PROJECT_ID || 'moverz-analytics'
const dataset = process.env.BIGQUERY_DATASET || 'moverz'

// Initialiser le client
export const bigquery = new BigQuery({
  projectId,
  keyFilename: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
})

// ========================================
// HELPERS INSERT
// ========================================

/**
 * Insérer des lignes dans une table BigQuery
 */
export async function insertRows<T extends Record<string, any>>(
  tableName: string,
  rows: T[]
): Promise<void> {
  if (rows.length === 0) {
    console.log(`[BigQuery] Aucune donnée à insérer dans ${tableName}`)
    return
  }

  const table = bigquery.dataset(dataset).table(tableName)
  
  try {
    await table.insert(rows, { skipInvalidRows: false, ignoreUnknownValues: false })
    console.log(`[BigQuery] ✅ ${rows.length} lignes insérées dans ${tableName}`)
  } catch (error: any) {
    console.error(`[BigQuery] ❌ Erreur insertion ${tableName}:`, error.message)
    
    // Log détaillé des erreurs
    if (error.errors && error.errors.length > 0) {
      error.errors.forEach((err: any, idx: number) => {
        console.error(`  Erreur ${idx + 1}:`, JSON.stringify(err, null, 2))
      })
    }
    
    throw error
  }
}

/**
 * Insérer avec gestion d'erreurs partielles
 */
export async function insertRowsSafe<T extends Record<string, any>>(
  tableName: string,
  rows: T[]
): Promise<{ inserted: number; failed: number }> {
  if (rows.length === 0) {
    return { inserted: 0, failed: 0 }
  }

  const table = bigquery.dataset(dataset).table(tableName)
  
  try {
    await table.insert(rows, { skipInvalidRows: true, ignoreUnknownValues: true })
    return { inserted: rows.length, failed: 0 }
  } catch (error: any) {
    const failedRows = error.errors?.length || 0
    const inserted = rows.length - failedRows
    
    console.warn(`[BigQuery] ⚠️ ${inserted}/${rows.length} lignes insérées dans ${tableName}`)
    
    return { inserted, failed: failedRows }
  }
}

// ========================================
// HELPERS QUERY
// ========================================

/**
 * Exécuter une requête SQL
 */
export async function query<T = any>(sql: string): Promise<T[]> {
  try {
    const [rows] = await bigquery.query({ query: sql })
    return rows as T[]
  } catch (error: any) {
    console.error('[BigQuery] ❌ Erreur query:', error.message)
    throw error
  }
}

/**
 * Vérifier si une table existe
 */
export async function tableExists(tableName: string): Promise<boolean> {
  try {
    const table = bigquery.dataset(dataset).table(tableName)
    const [exists] = await table.exists()
    return exists
  } catch {
    return false
  }
}

/**
 * Créer une table si elle n'existe pas
 */
export async function createTableIfNotExists(
  tableName: string,
  schema: any[]
): Promise<void> {
  const exists = await tableExists(tableName)
  
  if (!exists) {
    const table = bigquery.dataset(dataset).table(tableName)
    await table.create({ schema })
    console.log(`[BigQuery] ✅ Table ${tableName} créée`)
  }
}

// ========================================
// HELPERS UPSERT (via MERGE)
// ========================================

/**
 * Upsert via MERGE statement (pour éviter duplications)
 */
export async function upsert(
  tableName: string,
  rows: Record<string, any>[],
  keys: string[]
): Promise<void> {
  if (rows.length === 0) return

  // 1. Insérer dans table temporaire
  const tempTable = `${tableName}_temp_${Date.now()}`
  await insertRows(tempTable, rows)

  // 2. MERGE vers table finale
  const keyConditions = keys.map(k => `target.${k} = source.${k}`).join(' AND ')
  const columns = Object.keys(rows[0])
  const updateSet = columns.map(c => `target.${c} = source.${c}`).join(', ')
  const insertCols = columns.join(', ')
  const insertVals = columns.map(c => `source.${c}`).join(', ')

  const mergeSql = `
    MERGE \`${projectId}.${dataset}.${tableName}\` AS target
    USING \`${projectId}.${dataset}.${tempTable}\` AS source
    ON ${keyConditions}
    WHEN MATCHED THEN
      UPDATE SET ${updateSet}
    WHEN NOT MATCHED THEN
      INSERT (${insertCols})
      VALUES (${insertVals})
  `

  await query(mergeSql)

  // 3. Supprimer table temporaire
  await bigquery.dataset(dataset).table(tempTable).delete()
  
  console.log(`[BigQuery] ✅ Upsert ${rows.length} lignes dans ${tableName}`)
}

// ========================================
// HELPERS MONITORING
// ========================================

/**
 * Logger un job ETL
 */
export async function logETLJob(result: ETLJobResult): Promise<void> {
  await insertRows('etl_jobs_log', [{
    job_name: result.jobName,
    started_at: result.startedAt.toISOString(),
    completed_at: result.completedAt.toISOString(),
    status: result.status,
    rows_processed: result.rowsProcessed,
    errors: result.errors.join('; '),
    duration_seconds: (result.completedAt.getTime() - result.startedAt.getTime()) / 1000,
  }])
}

// ========================================
// EXPORTS
// ========================================

export default bigquery

