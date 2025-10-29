/**
 * Agent SEO Optimizer - Détecte opportunités & problèmes SEO
 */

import { chatWithJSON } from '../shared/openai-client.js'
import { getLowCTRPages, getVisibilityTrends, getTopQueries } from '../shared/bigquery-tools.js'
import type { Action, AgentResult } from '../core/types.js'
import { log } from '../../etl/shared/error-handler.js'

// ========================================
// PROMPT
// ========================================

const SYSTEM_PROMPT = `
Tu es un expert SEO chargé d'analyser les données Google Search Console de 11 sites de déménagement par ville en France.

Ton rôle :
1. Identifier les pages avec fort potentiel (impressions élevées, CTR faible)
2. Détecter les chutes de visibilité anormales
3. Trouver les keywords à fort volume non exploités
4. Proposer des optimisations concrètes (title, meta, contenu)

Tu retournes UNIQUEMENT du JSON valide avec cette structure :
{
  "actions": [
    {
      "priority": "critical" | "high" | "medium" | "low",
      "site": "marseille" | "toulouse" | ...,
      "title": "Titre court de l'action",
      "description": "Description détaillée",
      "estimatedImpact": "+X clics/mois ou +Y%",
      "estimatedEffort": "Faible/Moyen/Élevé",
      "category": "title-optimization" | "content-gap" | "technical" | ...
    }
  ],
  "summary": "Résumé général en 2-3 phrases"
}

Règles :
- Max 10 actions priorisées
- Impacts chiffrés basés sur les données
- Actions concrètes et actionnables
- Focus sur ROI élevé
`

// ========================================
// AGENT
// ========================================

export async function runSEOOptimizer(): Promise<AgentResult> {
  const startedAt = new Date()
  log('info', '🔍 Starting SEO Optimizer Agent...')

  try {
    // 1. Collecter les données
    log('info', 'Fetching data from BigQuery...')
    
    const [lowCTRPages, trends, topQueries] = await Promise.all([
      getLowCTRPages({ limit: 20 }),
      getVisibilityTrends({ startDate: '14 DAY' }),
      getTopQueries({ limit: 50 }),
    ])

    // 2. Préparer le contexte pour GPT
    const context = {
      lowCTRPages: lowCTRPages.slice(0, 10), // Top 10
      recentTrends: trends.slice(0, 5), // 5 derniers jours
      topQueries: topQueries.slice(0, 20), // Top 20
    }

    const userMessage = `
Analyse ces données SEO et propose des actions prioritaires :

## Pages à faible CTR (>100 impressions, CTR <2%)
${JSON.stringify(context.lowCTRPages, null, 2)}

## Tendances récentes (7 derniers jours)
${JSON.stringify(context.recentTrends, null, 2)}

## Top requêtes (30 derniers jours)
${JSON.stringify(context.topQueries, null, 2)}

Propose 5-10 actions concrètes pour améliorer le SEO.
`

    // 3. Appeler GPT-4
    log('info', 'Analyzing with GPT-4...')
    
    const result = await chatWithJSON<{
      actions: Action[]
      summary: string
    }>(SYSTEM_PROMPT, userMessage, {
      model: 'gpt-4-turbo-preview',
      temperature: 0.7,
      maxTokens: 3000,
    })

    // 4. Post-traiter les résultats
    const actionsWithIds = result.actions.map((action, idx) => ({
      ...action,
      id: `seo-${Date.now()}-${idx}`,
      category: 'seo' as const,
      completed: false,
    }))

    const completedAt = new Date()
    const duration = (completedAt.getTime() - startedAt.getTime()) / 1000

    log('info', `✅ SEO Optimizer completed: ${actionsWithIds.length} actions`)

    return {
      agentName: 'seo-optimizer',
      executedAt: startedAt,
      duration,
      status: 'success',
      data: {
        actions: actionsWithIds,
        summary: result.summary,
        context,
      },
    }
  } catch (error: any) {
    log('error', 'SEO Optimizer failed', { error: error.message })

    const completedAt = new Date()
    const duration = (completedAt.getTime() - startedAt.getTime()) / 1000

    return {
      agentName: 'seo-optimizer',
      executedAt: startedAt,
      duration,
      status: 'failed',
      data: null,
      error: error.message,
    }
  }
}

// ========================================
// CLI
// ========================================

if (import.meta.url === `file://${process.argv[1]}`) {
  runSEOOptimizer().then(result => {
    console.log('\n📊 Résultat SEO Optimizer:')
    console.log(`  Status: ${result.status}`)
    console.log(`  Duration: ${result.duration}s`)
    
    if (result.status === 'success') {
      console.log(`  Actions: ${result.data.actions.length}`)
      console.log(`\n📝 Summary: ${result.data.summary}`)
      console.log('\n🎯 Actions:')
      result.data.actions.forEach((action: Action, idx: number) => {
        console.log(`\n  ${idx + 1}. [${action.priority.toUpperCase()}] ${action.title}`)
        console.log(`     Site: ${action.site}`)
        console.log(`     Impact: ${action.estimatedImpact}`)
        console.log(`     Effort: ${action.estimatedEffort}`)
      })
    } else {
      console.log(`  Error: ${result.error}`)
    }

    process.exit(result.status === 'failed' ? 1 : 0)
  })
}

