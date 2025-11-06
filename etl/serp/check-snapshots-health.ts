/**
 * Health Check - Snapshots Métadonnées SERP
 * 
 * Vérifie que les snapshots tournent tous les jours
 * - Vérifie qu'un snapshot existe pour aujourd'hui
 * - Vérifie qu'un snapshot existe pour hier
 * - Vérifie qu'il n'y a pas trop de snapshots pending (> 3 jours)
 * - Envoie une alerte si problème détecté
 * 
 * Codes sortie: 0 (OK), 1 (alert)
 */

import { BigQuery } from '@google-cloud/bigquery'
import pino from 'pino'
import { format, subDays } from 'date-fns'

// ========================================
// Configuration
// ========================================

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
})

const config = {
  gcpProjectId: process.env.GCP_PROJECT_ID || 'moverz-dashboard',
  bqDataset: process.env.BQ_DATASET || 'analytics_core',
  gcpSaKeyJson: process.env.GCP_SA_KEY_JSON || '',
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '', // Optionnel
}

// Validation config
if (!config.gcpSaKeyJson) {
  logger.error('GCP_SA_KEY_JSON is required')
  process.exit(1)
}

const credentials = JSON.parse(config.gcpSaKeyJson)
const bigquery = new BigQuery({
  projectId: config.gcpProjectId,
  credentials,
})

const BQ_LOCATION = process.env.BQ_LOCATION || 'europe-west1'

// ========================================
// Vérifications
// ========================================

interface HealthCheckResult {
  ok: boolean
  alerts: string[]
  stats: {
    today: number
    yesterday: number
    pendingOld: number
  }
}

async function checkSnapshotsHealth(): Promise<HealthCheckResult> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const threeDaysAgo = format(subDays(new Date(), 3), 'yyyy-MM-dd')
  
  const alerts: string[] = []
  
  // 1. Vérifier snapshot aujourd'hui
  const todayQuery = `
    SELECT COUNT(*) as count
    FROM \`${config.gcpProjectId}.${config.bqDataset}.serp_metadata_snapshots\`
    WHERE snapshot_date = @today
  `
  const [todayRows] = await bigquery.query({
    query: todayQuery,
    location: BQ_LOCATION,
    params: { today },
  })
  const todayCount = Number((todayRows[0] as any).count) || 0
  
  if (todayCount === 0) {
    alerts.push(`⚠️ Aucun snapshot trouvé pour aujourd'hui (${today})`)
  }
  
  // 2. Vérifier snapshot hier
  const yesterdayQuery = `
    SELECT COUNT(*) as count
    FROM \`${config.gcpProjectId}.${config.bqDataset}.serp_metadata_snapshots\`
    WHERE snapshot_date = @yesterday
  `
  const [yesterdayRows] = await bigquery.query({
    query: yesterdayQuery,
    location: BQ_LOCATION,
    params: { yesterday },
  })
  const yesterdayCount = Number((yesterdayRows[0] as any).count) || 0
  
  if (yesterdayCount === 0) {
    alerts.push(`⚠️ Aucun snapshot trouvé pour hier (${yesterday})`)
  }
  
  // 3. Vérifier snapshots pending trop anciens (> 3 jours)
  const pendingQuery = `
    SELECT COUNT(*) as count
    FROM \`${config.gcpProjectId}.${config.bqDataset}.serp_metadata_snapshots\`
    WHERE status = 'pending'
      AND snapshot_date < @three_days_ago
  `
  const [pendingRows] = await bigquery.query({
    query: pendingQuery,
    location: BQ_LOCATION,
    params: { three_days_ago: threeDaysAgo },
  })
  const pendingOldCount = Number((pendingRows[0] as any).count) || 0
  
  if (pendingOldCount > 0) {
    alerts.push(`⚠️ ${pendingOldCount} snapshots pending depuis plus de 3 jours (complétion j+2 non effectuée)`)
  }
  
  return {
    ok: alerts.length === 0,
    alerts,
    stats: {
      today: todayCount,
      yesterday: yesterdayCount,
      pendingOld: pendingOldCount,
    },
  }
}

// ========================================
// Envoyer Alerte Slack (optionnel)
// ========================================

async function sendSlackAlert(alerts: string[]): Promise<void> {
  if (!config.slackWebhookUrl) {
    logger.warn('SLACK_WEBHOOK_URL not configured, skipping Slack alert')
    return
  }
  
  const message = {
    text: '🚨 Alerte - Snapshots Métadonnées SERP',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Alerte - Snapshots Métadonnées SERP',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: alerts.join('\n'),
        },
      },
    ],
  }
  
  try {
    const response = await fetch(config.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })
    
    if (!response.ok) {
      logger.warn(`Failed to send Slack alert: ${response.status}`)
    } else {
      logger.info('Slack alert sent')
    }
  } catch (error: any) {
    logger.warn(`Failed to send Slack alert: ${error.message}`)
  }
}

// ========================================
// Main
// ========================================

async function main() {
  try {
    const result = await checkSnapshotsHealth()
    
    logger.info('Health check completed', result.stats)
    
    if (!result.ok) {
      logger.error('Health check failed:', result.alerts)
      
      // Envoyer alerte Slack si configuré
      await sendSlackAlert(result.alerts)
      
      process.exit(1)
    } else {
      logger.info('✅ All checks passed')
      process.exit(0)
    }
  } catch (error: any) {
    logger.error('Health check failed:', error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

