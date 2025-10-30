/**
 * Orchestrateur - Lance tous les agents IA
 */

import { runSEOOptimizer } from '../seo-optimizer/agent.js'
import { runContentStrategist } from '../content-strategist/agent.js'
import { runTrafficAnalyst } from '../traffic-analyst/agent.js'
import { runReportGenerator } from '../report-generator/agent.js'
import { log } from '../../etl/shared/error-handler.js'
import { logAgentRun } from '../../etl/shared/bigquery-client.js'
import type { AgentResult } from './types.js'

// ========================================
// CONFIGURATION
// ========================================

const AGENTS = [
  {
    name: 'Traffic Analyst',
    fn: runTrafficAnalyst,
    schedule: 'daily', // Lancer après mise à jour ETL
  },
  {
    name: 'SEO Optimizer',
    fn: runSEOOptimizer,
    schedule: 'daily',
  },
  {
    name: 'Content Strategist',
    fn: runContentStrategist,
    schedule: 'weekly',
  },
  {
    name: 'Report Generator',
    fn: runReportGenerator,
    schedule: 'weekly', // Lundi 10:00
  },
  // TODO: Ajouter autres agents
  // { name: 'CRO Optimizer', fn: runCROOptimizer, schedule: 'weekly' },
  // { name: 'Alerts Manager', fn: runAlertsManager, schedule: 'hourly' },
]

// ========================================
// ORCHESTRATEUR
// ========================================

export async function runOrchestrator(): Promise<void> {
  log('info', '🤖 Starting Agent Orchestrator...')

  const results: AgentResult[] = []

  for (const agent of AGENTS) {
    log('info', `Running ${agent.name}...`)

    try {
      const result = await agent.fn()
      results.push(result)
      
      // Logger dans BigQuery
      try {
        await logAgentRun({
          id: `${result.agentName}-${Date.now()}`,
          agentName: result.agentName,
          executedAt: result.executedAt,
          duration: result.duration,
          status: result.status,
          data: result.data,
          error: result.error,
        })
      } catch (logError: any) {
        log('error', `Failed to log ${agent.name} run to BigQuery`, { error: logError.message })
      }
      
      if (result.status === 'success') {
        log('info', `✅ ${agent.name} completed in ${result.duration}s`)
      } else {
        log('error', `❌ ${agent.name} failed: ${result.error}`)
      }
    } catch (error: any) {
      log('error', `❌ ${agent.name} crashed: ${error.message}`)
    }
  }

  // Résumé
  const successCount = results.filter(r => r.status === 'success').length
  const failedCount = results.filter(r => r.status === 'failed').length

  log('info', `🏁 Orchestrator completed: ${successCount} success, ${failedCount} failed`)

  // TODO: Sauvegarder les résultats dans BigQuery
  // TODO: Envoyer notifications si agents critiques ont échoué
}

// ========================================
// CLI
// ========================================

if (import.meta.url === `file://${process.argv[1]}`) {
  runOrchestrator().then(() => {
    console.log('\n✅ All agents completed')
    process.exit(0)
  }).catch((error) => {
    console.error('\n❌ Orchestrator failed:', error)
    process.exit(1)
  })
}

