/**
 * Agent Traffic Analyst - Analyse détaillée du trafic (impressions/clics)
 * Déclenché automatiquement après chaque mise à jour ETL
 */

import 'dotenv/config'
import { chatWithJSON } from '../shared/openai-client.js'
import { 
  getGSCSummary, 
  getVisibilityTrends,
  getLowCTRPages,
  getTopQueries,
  getTopPages
} from '../shared/bigquery-tools.js'
import type { Action, AgentResult } from '../core/types.js'
import { log } from '../../etl/shared/error-handler.js'

// ========================================
// PROMPT
// ========================================

const SYSTEM_PROMPT = `
Tu es un expert en analyse de trafic organique pour 11 sites de déménagement par ville en France.

Ton rôle :
1. Analyser l'évolution du trafic (impressions, clics, CTR, position)
2. Identifier les tendances significatives (hausses, baisses)
3. Détecter les opportunités d'optimisation SEO
4. Repérer les anomalies et alertes importantes

Tu retournes UNIQUEMENT du JSON valide avec cette structure :
{
  "insights": [
    {
      "type": "trend" | "opportunity" | "alert" | "anomaly",
      "priority": "critical" | "high" | "medium" | "low",
      "site": "marseille" | "toulouse" | ...,
      "metric": "impressions" | "clicks" | "ctr" | "position",
      "title": "Titre de l'insight",
      "description": "Description détaillée",
      "data": {
        "current": 12345,
        "previous": 11234,
        "change": +9.9,
        "unit": "%" | "clicks" | "impressions"
      },
      "recommendation": "Action recommandée si applicable"
    }
  ],
  "summary": "Résumé global en 2-3 phrases",
  "highlights": [
    "Point 1 marquant",
    "Point 2 marquant",
    "Point 3 marquant"
  ]
}

Règles :
- Max 15 insights
- Prioriser par impact et urgence
- Analyser évolution sur 7j et 30j
- Identifier patterns et corrélations
`

// ========================================
// AGENT
// ========================================

export async function runTrafficAnalyst(): Promise<AgentResult> {
  const startedAt = new Date()
  log('info', '📊 Starting Traffic Analyst Agent...')

  try {
    // 1. Collecter les données détaillées
    log('info', 'Fetching detailed traffic data from BigQuery...')
    
    const [summary, trends, lowCTR, topQueries, topPages] = await Promise.all([
      getGSCSummary({ startDate: '30 DAY' }),
      getVisibilityTrends({ startDate: '30 DAY' }),
      getLowCTRPages({ limit: 20 }),
      getTopQueries({ limit: 30 }),
      getTopPages({ limit: 20 }),
    ])

    // 2. Préparer le contexte pour GPT
    const context = {
      summary,
      trends7d: trends.filter((t: any) => {
        const daysDiff = new Date().getTime() - new Date(t.date).getTime()
        return daysDiff <= 7 * 24 * 60 * 60 * 1000
      }),
      lowCTR: lowCTR.slice(0, 10),
      topQueries: topQueries.slice(0, 20),
      topPages: topPages.slice(0, 15),
    }

    const userMessage = `
Analyse ces données de trafic et identifie les insights importants :

## Vue d'ensemble (30 derniers jours)
${JSON.stringify(context.summary, null, 2)}

## Tendances récentes (7 derniers jours)
${JSON.stringify(context.trends7d, null, 2)}

## Pages à faible CTR (potentiel non exploité)
${JSON.stringify(context.lowCTR, null, 2)}

## Top requêtes (30 derniers jours)
${JSON.stringify(context.topQueries, null, 2)}

## Top pages par trafic
${JSON.stringify(context.topPages, null, 2)}

Propose une analyse détaillée avec insights, tendances, opportunités et alertes.
`

    // 3. Appeler GPT-4
    log('info', 'Analyzing with GPT-4...')
    
    const result = await chatWithJSON<{
      insights: any[]
      summary: string
      highlights: string[]
    }>(SYSTEM_PROMPT, userMessage, {
      model: 'gpt-4-turbo-preview',
      temperature: 0.7,
      maxTokens: 4000,
    })

    // 4. Post-traiter les résultats
    const insightsWithIds = result.insights.map((insight, idx) => ({
      ...insight,
      id: `traffic-${Date.now()}-${idx}`,
    }))

    const completedAt = new Date()
    const duration = (completedAt.getTime() - startedAt.getTime()) / 1000

    // Compter les types d'insights
    const counts = {
      trends: result.insights.filter(i => i.type === 'trend').length,
      opportunities: result.insights.filter(i => i.type === 'opportunity').length,
      alerts: result.insights.filter(i => i.type === 'alert').length,
      anomalies: result.insights.filter(i => i.type === 'anomaly').length,
    }

    log('info', `✅ Traffic Analyst completed: ${insightsWithIds.length} insights (${counts.trends} trends, ${counts.opportunities} opportunities, ${counts.alerts} alerts, ${counts.anomalies} anomalies)`)

    return {
      agentName: 'traffic-analyst',
      executedAt: startedAt,
      duration,
      status: 'success',
      data: {
        insights: insightsWithIds,
        summary: result.summary,
        highlights: result.highlights,
        counts,
        context,
      },
    }
  } catch (error: any) {
    log('error', 'Traffic Analyst failed', { error: error.message })

    const completedAt = new Date()
    const duration = (completedAt.getTime() - startedAt.getTime()) / 1000

    return {
      agentName: 'traffic-analyst',
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
  runTrafficAnalyst().then(result => {
    console.log('\n📊 Résultat Traffic Analyst:')
    console.log(`  Status: ${result.status}`)
    console.log(`  Duration: ${result.duration}s`)
    
    if (result.status === 'success') {
      console.log(`  Total insights: ${result.data.insights.length}`)
      console.log(`\n📝 Summary: ${result.data.summary}`)
      
      console.log('\n🎯 Highlights:')
      result.data.highlights.forEach((highlight, idx) => {
        console.log(`  ${idx + 1}. ${highlight}`)
      })
      
      if (result.data.insights.length > 0) {
        console.log('\n💡 Top Insights:')
        result.data.insights.slice(0, 5).forEach((insight: any, idx: number) => {
          console.log(`\n  ${idx + 1}. [${insight.type.toUpperCase()}] ${insight.title}`)
          console.log(`     Site: ${insight.site}`)
          console.log(`     Description: ${insight.description}`)
          if (insight.data) {
            console.log(`     Données: ${insight.data.current} vs ${insight.data.previous} (${insight.data.change > 0 ? '+' : ''}${insight.data.change}${insight.data.unit})`)
          }
        })
      }
    } else {
      console.log(`  Error: ${result.error}`)
    }

    process.exit(result.status === 'failed' ? 1 : 0)
  })
}

