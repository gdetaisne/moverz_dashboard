/**
 * Scheduler ETL - Orchestrateur quotidien
 */

import 'dotenv/config'
import cron from 'node-cron'
import { runGSCETL } from './gsc/fetch.js'
import { runLeadsSync } from './leads/sync.js'
import { runWebVitalsAggregator } from './web-vitals/aggregate.js'
import { logETLJob } from './shared/bigquery-client.js'
import { log } from './shared/error-handler.js'

// Import Traffic Analyst (agent IA)
import { runTrafficAnalyst } from '../agents/traffic-analyst/agent.js'

// ========================================
// JOBS ETL
// ========================================

async function executeGSCJob() {
  log('info', '🔄 Starting GSC ETL job...')
  
  try {
    const result = await runGSCETL()
    await logETLJob(result)
    
    log('info', '✅ GSC ETL completed', {
      status: result.status,
      rows: result.rowsProcessed,
    })

    // Lancer Traffic Analyst après mise à jour réussie (si clé OpenAI configurée)
    if ((result.status === 'success' || result.status === 'partial') && process.env.OPENAI_API_KEY) {
      log('info', '🤖 Triggering Traffic Analyst after GSC update...')
      try {
        const analystResult = await runTrafficAnalyst()
        log('info', '✅ Traffic Analyst completed', {
          status: analystResult.status,
          insights: analystResult.status === 'success' ? analystResult.data.insights.length : 0,
        })
      } catch (analystError: any) {
        log('error', '❌ Traffic Analyst failed', { error: analystError.message })
      }
    } else if (!process.env.OPENAI_API_KEY) {
      log('info', '⏭️  Skipping Traffic Analyst (OPENAI_API_KEY not configured)')
    }
  } catch (error: any) {
    log('error', '❌ GSC ETL failed', { error: error.message })
  }
}

async function executeLeadsJob() {
  log('info', '🔄 Starting Leads Sync job...')
  
  try {
    const result = await runLeadsSync()
    await logETLJob(result)
    
    log('info', '✅ Leads Sync completed', {
      status: result.status,
      rows: result.rowsProcessed,
    })
  } catch (error: any) {
    log('error', '❌ Leads Sync failed', { error: error.message })
  }
}

async function executeWebVitalsJob() {
  log('info', '🔄 Starting Web Vitals Aggregation job...')
  
  try {
    const result = await runWebVitalsAggregator()
    await logETLJob(result)
    
    log('info', '✅ Web Vitals Aggregation completed', {
      status: result.status,
      rows: result.rowsProcessed,
    })
  } catch (error: any) {
    log('error', '❌ Web Vitals Aggregation failed', { error: error.message })
  }
}

// ========================================
// SCHEDULER CONFIGURATION
// ========================================

function startScheduler() {
  log('info', '🚀 Starting ETL Scheduler...')

  // GSC: Tous les jours à 09:00 (après que Google ait publié les données J-1)
  cron.schedule('0 9 * * *', executeGSCJob, {
    timezone: 'Europe/Paris',
  })
  log('info', '⏰ GSC ETL scheduled: daily at 09:00')

  // Leads: Tous les jours à 10:00
  cron.schedule('0 10 * * *', executeLeadsJob, {
    timezone: 'Europe/Paris',
  })
  log('info', '⏰ Leads Sync scheduled: daily at 10:00')

  // Web Vitals: Tous les jours à 11:00
  cron.schedule('0 11 * * *', executeWebVitalsJob, {
    timezone: 'Europe/Paris',
  })
  log('info', '⏰ Web Vitals Aggregation scheduled: daily at 11:00')

  log('info', '✅ Scheduler started successfully')
  log('info', '💡 Press Ctrl+C to stop')
}

// ========================================
// EXECUTION MANUELLE (testing)
// ========================================

async function runAllJobsNow() {
  log('info', '▶️  Running all jobs manually...')
  
  await executeGSCJob()
  await executeLeadsJob()
  await executeWebVitalsJob()
  
  log('info', '✅ All jobs completed')
}

// ========================================
// CLI
// ========================================

const args = process.argv.slice(2)
const command = args[0]

if (command === 'run-now') {
  runAllJobsNow().then(() => process.exit(0)).catch((error) => {
    log('error', 'Execution failed', { error: error.message })
    process.exit(1)
  })
} else {
  // Mode scheduler (par défaut)
  startScheduler()
  
  // Keep alive
  process.on('SIGINT', () => {
    log('info', '👋 Stopping scheduler...')
    process.exit(0)
  })
}

