#!/usr/bin/env tsx

/**
 * Split Tables Script (Migration V1 → V2)
 * 
 * Migre gsc_daily_metrics (table unique) vers 3 tables séparées:
 * - gsc_global (métriques quotidiennes globales)
 * - gsc_pages (métriques par page)
 * - gsc_queries (métriques par requête)
 * 
 * Usage: npm run split-tables [--dry-run] [--confirm]
 * 
 * ⚠️ Cette migration est DESTRUCTIVE si --confirm est passé
 */

import { BigQuery } from '@google-cloud/bigquery'
import pino from 'pino'

const logger = pino({
  level: 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
})

// ========================================
// Configuration
// ========================================

const config = {
  gcpProjectId: process.env.GCP_PROJECT_ID || 'moverz-dashboard',
  bqDataset: process.env.BQ_DATASET || 'analytics_core',
  gcpSaKeyJson: process.env.GCP_SA_KEY_JSON || '',
}

if (!config.gcpSaKeyJson) {
  logger.error('GCP_SA_KEY_JSON is required')
  process.exit(1)
}

const credentials = JSON.parse(config.gcpSaKeyJson)
const bigquery = new BigQuery({
  projectId: config.gcpProjectId,
  credentials,
})

const dataset = bigquery.dataset(config.bqDataset)

// ========================================
// DDL Nouvelles Tables
// ========================================

const DDL_GSC_GLOBAL = `
CREATE TABLE IF NOT EXISTS \`${config.gcpProjectId}.${config.bqDataset}.gsc_global\` (
  date DATE NOT NULL,
  site STRING NOT NULL,
  clicks INT64 NOT NULL,
  impressions INT64 NOT NULL,
  ctr FLOAT64 NOT NULL,
  position FLOAT64 NOT NULL,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY site
OPTIONS(
  description = "GSC metrics: daily global aggregates",
  require_partition_filter = TRUE,
  partition_expiration_days = 730
);
`

const DDL_GSC_PAGES = `
CREATE TABLE IF NOT EXISTS \`${config.gcpProjectId}.${config.bqDataset}.gsc_pages\` (
  date DATE NOT NULL,
  site STRING NOT NULL,
  page STRING NOT NULL,
  clicks INT64 NOT NULL,
  impressions INT64 NOT NULL,
  ctr FLOAT64 NOT NULL,
  position FLOAT64 NOT NULL,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY site, page
OPTIONS(
  description = "GSC metrics: by page",
  require_partition_filter = TRUE,
  partition_expiration_days = 730
);
`

const DDL_GSC_QUERIES = `
CREATE TABLE IF NOT EXISTS \`${config.gcpProjectId}.${config.bqDataset}.gsc_queries\` (
  date DATE NOT NULL,
  site STRING NOT NULL,
  query STRING NOT NULL,
  clicks INT64 NOT NULL,
  impressions INT64 NOT NULL,
  ctr FLOAT64 NOT NULL,
  position FLOAT64 NOT NULL,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY date
CLUSTER BY site, query
OPTIONS(
  description = "GSC metrics: by query",
  require_partition_filter = TRUE,
  partition_expiration_days = 730
);
`

// ========================================
// Requêtes de Migration
// ========================================

const MIGRATE_GLOBAL = `
INSERT INTO \`${config.gcpProjectId}.${config.bqDataset}.gsc_global\`
  (date, site, clicks, impressions, ctr, position, ingested_at)
SELECT 
  date,
  domain as site,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr,
  AVG(position) as position,
  MAX(ingested_at) as ingested_at
FROM \`${config.gcpProjectId}.${config.bqDataset}.gsc_daily_metrics\`
GROUP BY date, site
`

const MIGRATE_PAGES = `
INSERT INTO \`${config.gcpProjectId}.${config.bqDataset}.gsc_pages\`
  (date, site, page, clicks, impressions, ctr, position, ingested_at)
SELECT 
  date,
  domain as site,
  page,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr,
  AVG(position) as position,
  MAX(ingested_at) as ingested_at
FROM \`${config.gcpProjectId}.${config.bqDataset}.gsc_daily_metrics\`
GROUP BY date, site, page
`

const MIGRATE_QUERIES = `
INSERT INTO \`${config.gcpProjectId}.${config.bqDataset}.gsc_queries\`
  (date, site, query, clicks, impressions, ctr, position, ingested_at)
SELECT 
  date,
  domain as site,
  query,
  SUM(clicks) as clicks,
  SUM(impressions) as impressions,
  SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr,
  AVG(position) as position,
  MAX(ingested_at) as ingested_at
FROM \`${config.gcpProjectId}.${config.bqDataset}.gsc_daily_metrics\`
GROUP BY date, site, query
`

// ========================================
// Migration Steps
// ========================================

async function createNewTables(dryRun: boolean) {
  logger.info('Step 1: Creating new tables...')
  
  const tables = [
    { name: 'gsc_global', ddl: DDL_GSC_GLOBAL },
    { name: 'gsc_pages', ddl: DDL_GSC_PAGES },
    { name: 'gsc_queries', ddl: DDL_GSC_QUERIES },
  ]
  
  for (const table of tables) {
    if (dryRun) {
      logger.info({ table: table.name }, `[DRY-RUN] Would create table: ${table.name}`)
    } else {
      try {
        const [job] = await bigquery.createQueryJob({ query: table.ddl })
        await job.getQueryResults()
        logger.info({ table: table.name }, `Created table: ${table.name}`)
      } catch (error: any) {
        if (error.message?.includes('Already Exists')) {
          logger.warn({ table: table.name }, `Table already exists: ${table.name}`)
        } else {
          throw error
        }
      }
    }
  }
}

async function migrateData(dryRun: boolean) {
  logger.info('Step 2: Migrating data...')
  
  const migrations = [
    { name: 'gsc_global', query: MIGRATE_GLOBAL },
    { name: 'gsc_pages', query: MIGRATE_PAGES },
    { name: 'gsc_queries', query: MIGRATE_QUERIES },
  ]
  
  for (const migration of migrations) {
    if (dryRun) {
      logger.info({ table: migration.name }, `[DRY-RUN] Would migrate data to: ${migration.name}`)
      
      // Dry-run: count rows
      const countQuery = migration.query.replace('INSERT INTO', '-- INSERT INTO').replace(/^/, 'SELECT COUNT(*) as row_count FROM (') + ') AS subquery'
      const [rows] = await bigquery.query(countQuery)
      logger.info({ table: migration.name, rowCount: rows[0]?.row_count }, 'Estimated rows to migrate')
      
    } else {
      try {
        const startTime = Date.now()
        const [job] = await bigquery.createQueryJob({ query: migration.query })
        await job.getQueryResults()
        const duration = Date.now() - startTime
        
        // Count migrated rows
        const countQuery = `SELECT COUNT(*) as row_count FROM \`${config.gcpProjectId}.${config.bqDataset}.${migration.name}\``
        const [rows] = await bigquery.query(countQuery)
        
        logger.info({ 
          table: migration.name, 
          rowCount: rows[0]?.row_count,
          duration 
        }, `Migrated data to: ${migration.name}`)
        
      } catch (error: any) {
        logger.error({ table: migration.name, error: error.message }, `Failed to migrate: ${migration.name}`)
        throw error
      }
    }
  }
}

async function validateMigration() {
  logger.info('Step 3: Validating migration...')
  
  // Compare totals
  const queries = {
    old_total: `SELECT SUM(clicks) as clicks, SUM(impressions) as impressions FROM \`${config.gcpProjectId}.${config.bqDataset}.gsc_daily_metrics\``,
    new_global: `SELECT SUM(clicks) as clicks, SUM(impressions) as impressions FROM \`${config.gcpProjectId}.${config.bqDataset}.gsc_global\``,
    new_pages: `SELECT SUM(clicks) as clicks, SUM(impressions) as impressions FROM \`${config.gcpProjectId}.${config.bqDataset}.gsc_pages\``,
    new_queries: `SELECT SUM(clicks) as clicks, SUM(impressions) as impressions FROM \`${config.gcpProjectId}.${config.bqDataset}.gsc_queries\``,
  }
  
  const results: any = {}
  
  for (const [key, query] of Object.entries(queries)) {
    const [rows] = await bigquery.query(query)
    results[key] = rows[0]
  }
  
  logger.info({ results }, 'Validation results')
  
  // Check consistency
  const oldTotal = results.old_total
  const newGlobal = results.new_global
  
  const clicksDiff = Math.abs(oldTotal.clicks - newGlobal.clicks)
  const impressionsDiff = Math.abs(oldTotal.impressions - newGlobal.impressions)
  
  if (clicksDiff > 0.01 * oldTotal.clicks || impressionsDiff > 0.01 * oldTotal.impressions) {
    logger.warn({ oldTotal, newGlobal, clicksDiff, impressionsDiff }, 'Validation WARNING: totals differ by >1%')
  } else {
    logger.info('Validation OK: totals match ✅')
  }
}

async function backupOldTable(dryRun: boolean) {
  logger.info('Step 4: Backing up old table...')
  
  const backupTable = `${config.bqDataset}.gsc_daily_metrics_backup`
  
  if (dryRun) {
    logger.info(`[DRY-RUN] Would backup to: ${backupTable}`)
  } else {
    try {
      const query = `
        CREATE TABLE \`${config.gcpProjectId}.${backupTable}\` 
        AS SELECT * FROM \`${config.gcpProjectId}.${config.bqDataset}.gsc_daily_metrics\`
      `
      const [job] = await bigquery.createQueryJob({ query })
      await job.getQueryResults()
      
      logger.info({ backupTable }, 'Backup created ✅')
    } catch (error: any) {
      logger.error({ error: error.message }, 'Backup failed')
      throw error
    }
  }
}

// ========================================
// CLI
// ========================================

async function runMigration() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const confirm = args.includes('--confirm')
  
  if (!dryRun && !confirm) {
    logger.error('Missing --confirm flag. This migration is DESTRUCTIVE.')
    logger.info('Run with --dry-run to preview, or --confirm to execute')
    process.exit(1)
  }
  
  logger.info({ 
    dryRun, 
    confirm, 
    project: config.gcpProjectId, 
    dataset: config.bqDataset 
  }, 'Starting split-tables migration')
  
  try {
    // Step 1: Create new tables
    await createNewTables(dryRun)
    
    // Step 2: Migrate data
    await migrateData(dryRun)
    
    if (!dryRun) {
      // Step 3: Validate
      await validateMigration()
      
      // Step 4: Backup old table
      await backupOldTable(dryRun)
      
      logger.info('✅ Migration completed successfully!')
      logger.info('Next steps:')
      logger.info('  1. Update ETL code to use new tables')
      logger.info('  2. Test thoroughly')
      logger.info('  3. Drop old table: DROP TABLE `gsc_daily_metrics`')
    }
    
  } catch (error: any) {
    logger.fatal({ error: error.message }, 'Migration failed')
    process.exit(1)
  }
}

runMigration()

