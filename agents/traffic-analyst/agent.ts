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
import { insertAgentInsights } from '../../etl/shared/bigquery-client.js'
import { ACTIVE_SITES } from '../../etl/shared/config.js'

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
    const allInsightsToStore: any[] = []
    
    // Analyser chaque site individuellement
    for (const site of ACTIVE_SITES) {
      log('info', `Analyzing traffic for ${site}...`)
      
      // 1. Collecter les données pour ce site
      const [summary, trends, lowCTR, topQueries, topPages] = await Promise.all([
        getGSCSummary({ site, startDate: '30 DAY' }),
        getVisibilityTrends({ site, startDate: '30 DAY' }),
        getLowCTRPages({ site, limit: 10 }),
        getTopQueries({ site, limit: 20 }),
        getTopPages({ site, limit: 10 }),
      ])
      
      // Si pas de données, on passe
      if (!summary || summary.length === 0) {
        log('info', `No data for ${site}, skipping`)
        continue
      }

      // 2. Préparer le contexte pour GPT
      const siteData = summary[0] || {}
      const context = {
        site,
        summary: siteData,
        trends7d: trends.filter((t: any) => {
          const daysDiff = new Date().getTime() - new Date(t.date).getTime()
          return daysDiff <= 7 * 24 * 60 * 60 * 1000
        }),
        lowCTR,
        topQueries: topQueries.slice(0, 10),
        topPages: topPages.slice(0, 10),
      }

      const userMessage = `
Analyse ces données de trafic pour ${site} et génère UN insight synthétique :

## Vue d'ensemble (30 derniers jours)
- Impressions: ${siteData.total_impressions || 0}
- Clics: ${siteData.total_clicks || 0}
- CTR moyen: ${(siteData.avg_ctr * 100).toFixed(2)}%
- Position moyenne: ${siteData.avg_position?.toFixed(1) || 'N/A'}

## Tendances récentes (7 derniers jours)
${JSON.stringify(context.trends7d.slice(0, 7), null, 2)}

## Pages à faible CTR
${JSON.stringify(lowCTR.slice(0, 5), null, 2)}

## Top requêtes
${JSON.stringify(context.topQueries.slice(0, 5), null, 2)}

Génère UN insight concis (max 200 caractères) sur la performance actuelle et UNE action prioritaire.
Format: {
  "title": "Titre court",
  "summary": "Résumé concis de la performance",
  "priority": "critical" | "high" | "medium" | "low",
  "actions": [
    {"priority": "high", "title": "Action 1", "impact": "Description", "effort": "Faible|Moyen|Élevé"}
  ]
}
`

      // 3. Appeler GPT-4
      const result = await chatWithJSON<{
        title: string
        summary: string
        priority: string
        actions: any[]
      }>(SYSTEM_PROMPT, userMessage, {
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 500,
      })

      // 4. Stocker l'insight
      const insight = {
        id: `traffic-${site}-${Date.now()}`,
        runDate: new Date().toISOString().split('T')[0],
        site,
        agent: 'traffic',
        severity: result.priority === 'critical' ? 'critical' as const : 
                  result.priority === 'high' ? 'warn' as const : 'info' as const,
        title: result.title,
        summary: result.summary,
        payload: {
          metrics: siteData,
          trends: context.trends7d.slice(0, 7),
          lowCTR: lowCTR.slice(0, 3),
        },
        suggestedActions: result.actions || [],
        score: Math.min(1, (siteData.total_clicks || 0) / 100), // Score basé sur les clics
      }
      
      allInsightsToStore.push(insight)
    }
    
    // 5. Écrire tous les insights dans BigQuery
    if (allInsightsToStore.length > 0) {
      log('info', `Storing ${allInsightsToStore.length} insights in BigQuery...`)
      await insertAgentInsights(allInsightsToStore)
    }

    const completedAt = new Date()
    const duration = (completedAt.getTime() - startedAt.getTime()) / 1000

    log('info', `✅ Traffic Analyst completed: ${allInsightsToStore.length} insights for ${ACTIVE_SITES.length} sites`)

    return {
      agentName: 'traffic-analyst',
      executedAt: startedAt,
      duration,
      status: 'success',
      data: {
        insights: allInsightsToStore,
        sitesAnalyzed: ACTIVE_SITES.length,
        insightsCreated: allInsightsToStore.length,
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
      console.log(`  Sites analyzed: ${result.data.sitesAnalyzed}`)
      console.log(`  Insights created: ${result.data.insightsCreated}`)
      
      if (result.data.insights.length > 0) {
        console.log('\n💡 Insights per site:')
        result.data.insights.forEach((insight: any) => {
          console.log(`\n  🌍 ${insight.site}`)
          console.log(`     ${insight.title}`)
          console.log(`     ${insight.summary}`)
          console.log(`     Priority: ${insight.severity}`)
          if (insight.suggestedActions && insight.suggestedActions.length > 0) {
            console.log(`     Actions: ${insight.suggestedActions.length}`)
          }
        })
      }
    } else {
      console.log(`  Error: ${result.error}`)
    }

    process.exit(result.status === 'failed' ? 1 : 0)
  })
}

