/**
 * ETL Leads PostgreSQL → BigQuery
 */

import pg from 'pg'
import { insertRows } from '../shared/bigquery-client.js'
import { withErrorHandling, log } from '../shared/error-handler.js'
import type { Lead, ETLJobResult } from '../shared/types.js'

const { Pool } = pg

// ========================================
// CONFIGURATION
// ========================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// ========================================
// FETCH LEADS FROM POSTGRESQL
// ========================================

async function fetchLeadsFromPostgres(date: string): Promise<Lead[]> {
  const client = await pool.connect()
  
  try {
    // Adapter la requête selon votre schéma Prisma
    const query = `
      SELECT 
        id,
        created_at,
        site,
        source,
        medium,
        utm_source,
        utm_medium,
        utm_campaign,
        form_data,
        status
      FROM leads
      WHERE DATE(created_at) = $1
      ORDER BY created_at DESC
    `
    
    const result = await client.query(query, [date])
    
    return result.rows.map(row => ({
      id: row.id,
      createdAt: new Date(row.created_at),
      site: row.site,
      source: row.source,
      medium: row.medium,
      utmSource: row.utm_source,
      utmMedium: row.utm_medium,
      utmCampaign: row.utm_campaign,
      formData: row.form_data,
      status: row.status,
    }))
  } finally {
    client.release()
  }
}

// ========================================
// ETL PRINCIPAL
// ========================================

export async function runLeadsSync(date?: string): Promise<ETLJobResult> {
  const startedAt = new Date()
  const targetDate = date || getYesterday()
  
  log('info', 'Starting Leads Sync', { targetDate })

  try {
    const leads = await fetchLeadsFromPostgres(targetDate)
    
    log('info', `Fetched ${leads.length} leads from PostgreSQL`)

    if (leads.length > 0) {
      const rows = leads.map(lead => ({
        id: lead.id,
        created_at: lead.createdAt.toISOString(),
        site: lead.site,
        source: lead.source || null,
        medium: lead.medium || null,
        utm_source: lead.utmSource || null,
        utm_medium: lead.utmMedium || null,
        utm_campaign: lead.utmCampaign || null,
        form_data: JSON.stringify(lead.formData),
        status: lead.status,
        updated_at: null,
      }))

      await insertRows('leads', rows)
      
      log('info', `✅ ${leads.length} leads synced to BigQuery`)
    }

    const completedAt = new Date()
    
    return {
      jobName: 'leads-sync',
      startedAt,
      completedAt,
      status: 'success',
      rowsProcessed: leads.length,
      errors: [],
    }
  } catch (error: any) {
    log('error', 'Leads sync failed', { error: error.message })
    
    const completedAt = new Date()
    
    return {
      jobName: 'leads-sync',
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
  withErrorHandling('leads-sync', async () => {
    const result = await runLeadsSync()
    
    console.log('\n📊 Résultat:')
    console.log(`  Status: ${result.status}`)
    console.log(`  Rows: ${result.rowsProcessed}`)
    console.log(`  Duration: ${(result.completedAt.getTime() - result.startedAt.getTime()) / 1000}s`)

    process.exit(result.status === 'failed' ? 1 : 0)
  })
}

