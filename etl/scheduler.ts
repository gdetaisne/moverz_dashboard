/**
 * Scheduler ETL - Orchestrateur quotidien
 */

import 'dotenv/config'
import cron from 'node-cron'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { runGSCETL } from './gsc/fetch.js'
import { fetchGSCIssues } from './gsc/fetch-issues.js'
import { runLeadsSync } from './leads/sync.js'
import { runWebVitalsAggregator } from './web-vitals/aggregate.js'
import { logETLJob } from './shared/bigquery-client.js'
import { log } from './shared/error-handler.js'

// Import Agents IA
import { runTrafficAnalyst } from '../agents/traffic-analyst/agent.js'
import { runGSCIssuesAnalyzer } from '../agents/gsc-issues-analyzer/agent.js'

const execAsync = promisify(exec)
const projectRoot = path.resolve(new URL('.', import.meta.url).pathname, '..')

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

async function executeGSCIssuesJob() {
  log('info', '🔄 Starting GSC Issues job...')
  
  try {
    await fetchGSCIssues()
    
    log('info', '✅ GSC Issues completed')
    
    // Lancer l'agent IA d'analyse après mise à jour réussie (si clé OpenAI configurée)
    if (process.env.OPENAI_API_KEY) {
      log('info', '🤖 Triggering GSC Issues Analyzer after update...')
      try {
        const analyzerResult = await runGSCIssuesAnalyzer()
        log('info', '✅ GSC Issues Analyzer completed', {
          status: analyzerResult.status,
          insights: analyzerResult.status === 'success' ? analyzerResult.insights.length : 0,
        })
      } catch (analyzerError: any) {
        log('error', '❌ GSC Issues Analyzer failed', { error: analyzerError.message })
      }
    } else {
      log('info', '⏭️  Skipping GSC Issues Analyzer (OPENAI_API_KEY not configured)')
    }
  } catch (error: any) {
    log('error', '❌ GSC Issues failed', { error: error.message })
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

async function executeSerpSnapshotJob() {
  log('info', '🔄 Starting SERP Metadata Snapshot job...')
  
  try {
    const snapshotScript = path.join(projectRoot, 'etl', 'serp', 'snapshot-metadata.ts')
    const command = `npx tsx ${snapshotScript}`
    
    const { stdout, stderr } = await execAsync(command, {
      env: process.env,
      timeout: 300000, // 5 minutes
      maxBuffer: 10 * 1024 * 1024,
    })
    
    const successMatch = stdout.match(/success[:\s]+(\d+)/i)
    const failedMatch = stdout.match(/failed[:\s]+(\d+)/i)
    const success = successMatch ? parseInt(successMatch[1], 10) : 0
    const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0
    
    log('info', '✅ SERP Metadata Snapshot completed', {
      success,
      failed,
    })
  } catch (error: any) {
    log('error', '❌ SERP Metadata Snapshot failed', { error: error.message })
  }
}

async function executeSerpCompleteJob() {
  log('info', '🔄 Starting SERP Snapshots Completion job (j+2)...')
  
  try {
    const completeScript = path.join(projectRoot, 'etl', 'serp', 'complete-snapshots.ts')
    const command = `npx tsx ${completeScript}`
    
    const { stdout, stderr } = await execAsync(command, {
      env: process.env,
      timeout: 300000,
      maxBuffer: 10 * 1024 * 1024,
    })
    
    const completedMatch = stdout.match(/completed[:\s]+(\d+)/i)
    const completed = completedMatch ? parseInt(completedMatch[1], 10) : 0
    
    log('info', '✅ SERP Snapshots Completion completed', {
      completed,
    })
  } catch (error: any) {
    log('error', '❌ SERP Snapshots Completion failed', { error: error.message })
  }
}

async function executeSerpHealthCheckJob() {
  log('info', '🔄 Starting SERP Snapshots Health Check...')
  
  try {
    const healthScript = path.join(projectRoot, 'etl', 'serp', 'check-snapshots-health.ts')
    const command = `npx tsx ${healthScript}`
    
    const { stdout, stderr } = await execAsync(command, {
      env: process.env,
      timeout: 60000, // 1 minute
      maxBuffer: 1024 * 1024,
    })
    
    log('info', '✅ SERP Snapshots Health Check completed')
  } catch (error: any) {
    // Health check échoue si problème détecté (exit code 1)
    log('error', '⚠️ SERP Snapshots Health Check detected issues', { 
      error: error.message,
      stdout: error.stdout?.slice(-500),
    })
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

  // GSC Issues: 2 fois par jour à 09:30 et 17:30
  cron.schedule('30 9 * * *', executeGSCIssuesJob, {
    timezone: 'Europe/Paris',
  })
  log('info', '⏰ GSC Issues scheduled: daily at 09:30')
  
  cron.schedule('30 17 * * *', executeGSCIssuesJob, {
    timezone: 'Europe/Paris',
  })
  log('info', '⏰ GSC Issues scheduled: daily at 17:30')

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

  // SERP Metadata Snapshot: Tous les jours à 12:00 (après GSC)
  cron.schedule('0 12 * * *', executeSerpSnapshotJob, {
    timezone: 'Europe/Paris',
  })
  log('info', '⏰ SERP Metadata Snapshot scheduled: daily at 12:00')

  // SERP Snapshots Completion (j+2): Tous les jours à 13:00
  cron.schedule('0 13 * * *', executeSerpCompleteJob, {
    timezone: 'Europe/Paris',
  })
  log('info', '⏰ SERP Snapshots Completion scheduled: daily at 13:00')

  // SERP Health Check: Tous les jours à 14:00
  cron.schedule('0 14 * * *', executeSerpHealthCheckJob, {
    timezone: 'Europe/Paris',
  })
  log('info', '⏰ SERP Health Check scheduled: daily at 14:00')

  log('info', '✅ Scheduler started successfully')
  log('info', '💡 Press Ctrl+C to stop')
}

// ========================================
// EXECUTION MANUELLE (testing)
// ========================================

async function runAllJobsNow() {
  log('info', '▶️  Running all jobs manually...')
  
  await executeGSCJob()
  await executeGSCIssuesJob()
  await executeLeadsJob()
  await executeWebVitalsJob()
  await executeSerpSnapshotJob()
  await executeSerpCompleteJob()
  await executeSerpHealthCheckJob()
  
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

