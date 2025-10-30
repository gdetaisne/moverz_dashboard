/**
 * Agent Report Generator - Génère des rapports hebdomadaires automatiques
 * V1: 1 rapport global multi-sites uniquement
 */

import 'dotenv/config'
import { format } from 'date-fns'
import { chatWithJSON } from '../shared/openai-client.js'
import { 
  getGSCSummary, 
  getVisibilityTrends,
  getTopPages,
  getTopQueries 
} from '../shared/bigquery-tools.js'
import { getLatestInsights, insertAgentInsights } from '../../etl/shared/bigquery-client.js'
import { pushWeeklyReport } from '../shared/slack-notifier.js'
import type { AgentResult } from '../core/types.js'
import { log } from '../../etl/shared/error-handler.js'
import { z } from 'zod'

// ========================================
// VALIDATION SCHEMA
// ========================================

const ActionSchema = z.object({
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  title: z.string(),
  site: z.string(),
  impact: z.string().optional(),
  effort: z.enum(['Faible', 'Moyen', 'Élevé']).optional(),
})

const ReportSchema = z.object({
  summary: z.string().min(50).max(500),
  actions_top: z.array(ActionSchema).min(3).max(7),
  report_md: z.string().min(200),
  severity: z.enum(['info', 'warn', 'critical']),
  score: z.number().min(0).max(1),
})

type ReportOutput = z.infer<typeof ReportSchema>

// ========================================
// PROMPT
// ========================================

const SYSTEM_PROMPT = `
Tu es un consultant SEO senior qui rédige des rapports hebdomadaires pour un réseau de 11 sites de déménagement.

Ton rôle :
1. Analyser les données GSC des 14 derniers jours
2. Identifier les top winners et losers
3. Compiler les insights des agents (traffic, seo, content)
4. Produire un rapport clair et actionnable

Tu retournes UNIQUEMENT du JSON valide avec cette structure :
{
  "summary": "Résumé exécutif en 2-3 phrases (≤120 mots)",
  "actions_top": [
    {
      "priority": "critical" | "high" | "medium" | "low",
      "title": "Titre de l'action",
      "site": "marseille" | "toulouse" | ...,
      "impact": "Impact estimé",
      "effort": "Faible" | "Moyen" | "Élevé"
    }
  ],
  "report_md": "Rapport complet en Markdown formaté",
  "severity": "info" | "warn" | "critical",
  "score": 0.0-1.0
}

Règles critiques :
- summary : concis, titres, puces. Max 120 mots.
- actions_top : 3-7 actions priorisées (critical en premier)
- report_md : Markdown complet avec sections (## Vue d'ensemble, ## Winners/Losers, ## Actions, etc.)
- severity : "critical" si baisse >15%, "warn" si baisse 5-15%, "info" sinon
- score : 0-1 basé sur l'urgence (0.9+ si critical, 0.5-0.8 si warn, <0.5 si info)

Format attendu pour report_md :
# 📊 Rapport Hebdomadaire - Semaine XX

## 🎯 Vue d'Ensemble
[Métriques réseau]

## 🏆 Top Performers
[3 meilleurs sites]

## ⚠️ Alertes
[Sites en difficulté]

## 💡 Actions Recommandées
[5-7 actions détaillées avec contexte]

## 📈 Tendances
[Observations importantes]
`

// ========================================
// GARDE-FOUS
// ========================================

function shouldDowngradeSeverity(data: {
  totalImpressions: number
  variation: number
}): { severity: 'info' | 'warn' | 'critical'; reason?: string } {
  // Si trafic total < 3000 impressions/semaine, downgrade à info
  if (data.totalImpressions < 3000) {
    return {
      severity: 'info',
      reason: 'Trafic trop faible pour être significatif (<3000 imp/sem)',
    }
  }

  // Si aucune variation > ±5%, downgrade à info
  if (Math.abs(data.variation) < 5) {
    return {
      severity: 'info',
      reason: 'Aucune variation significative (±5%)',
    }
  }

  // Calcul normal
  if (data.variation <= -15) return { severity: 'critical' }
  if (data.variation <= -5) return { severity: 'warn' }
  return { severity: 'info' }
}

// ========================================
// AGENT
// ========================================

export async function runReportGenerator(): Promise<AgentResult> {
  const startedAt = new Date()
  log('info', '📊 Starting Report Generator Agent...')

  try {
    // 1. Collecter les données GSC (14 derniers jours)
    log('info', 'Fetching GSC data (14 days)...')
    
    const [summary14d, trends, topPages, topQueries] = await Promise.all([
      getGSCSummary({ startDate: '14 DAY' }),
      getVisibilityTrends({ startDate: '14 DAY' }),
      getTopPages({ limit: 10, startDate: '14 DAY' }),
      getTopQueries({ limit: 30, startDate: '14 DAY' }),
    ])

    // 2. Récupérer les derniers insights des autres agents
    log('info', 'Fetching recent insights from other agents...')
    const recentInsights = await getLatestInsights({
      days: 7,
      limit: 20,
    })

    // 3. Calculer métriques agrégées
    const totalImpressions = summary14d.reduce((sum: number, s: any) => sum + (s.total_impressions || 0), 0)
    const totalClicks = summary14d.reduce((sum: number, s: any) => sum + (s.total_clicks || 0), 0)
    
    // Identifier winners/losers
    const sortedBySiteImpact = trends
      .filter((t: any) => t.impressions_change !== null)
      .sort((a: any, b: any) => (b.impressions_change || 0) - (a.impressions_change || 0))

    const winners = sortedBySiteImpact.slice(0, 3)
    const losers = sortedBySiteImpact.slice(-3).reverse()

    // Calcul variation globale
    const avgVariation = sortedBySiteImpact.length > 0
      ? sortedBySiteImpact.reduce((sum: number, t: any) => sum + (t.impressions_change || 0) * 100, 0) / sortedBySiteImpact.length
      : 0

    // 4. Garde-fou: vérifier si on doit downgrader la sévérité
    const severityCheck = shouldDowngradeSeverity({
      totalImpressions,
      variation: avgVariation,
    })

    if (severityCheck.reason) {
      log('info', `Downgrade severity: ${severityCheck.reason}`)
    }

    // 5. Préparer le contexte pour GPT
    const context = {
      period: {
        start: format(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd'),
      },
      network_summary: {
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        avg_variation_pct: avgVariation.toFixed(1),
      },
      winners: winners.map((w: any) => ({
        site: w.site,
        change_pct: ((w.impressions_change || 0) * 100).toFixed(1),
      })),
      losers: losers.map((l: any) => ({
        site: l.site,
        change_pct: ((l.impressions_change || 0) * 100).toFixed(1),
      })),
      top_queries: topQueries.slice(0, 10),
      low_ctr_opportunities: topPages.filter((p: any) => p.avg_ctr < 0.02).slice(0, 5),
      recent_insights: recentInsights.map((i: any) => ({
        agent: i.agent,
        severity: i.severity,
        title: i.title,
        site: i.site,
      })),
    }

    const userMessage = `
Génère un rapport hebdomadaire basé sur ces données :

## Contexte
- Période : ${context.period.start} → ${context.period.end}
- Réseau : ${context.network_summary.total_impressions.toLocaleString()} impressions, ${context.network_summary.total_clicks.toLocaleString()} clics
- Variation moyenne : ${context.network_summary.avg_variation_pct}%

## Winners (top 3)
${JSON.stringify(context.winners, null, 2)}

## Losers (bottom 3)
${JSON.stringify(context.losers, null, 2)}

## Top requêtes
${JSON.stringify(context.top_queries, null, 2)}

## Opportunités faible CTR
${JSON.stringify(context.low_ctr_opportunities, null, 2)}

## Insights récents (autres agents)
${JSON.stringify(context.recent_insights, null, 2)}

Génère le rapport complet JSON.
`

    // 6. Appeler GPT-4
    log('info', 'Generating report with GPT-4...')
    
    const rawResult = await chatWithJSON<ReportOutput>(SYSTEM_PROMPT, userMessage, {
      model: 'gpt-4-turbo-preview',
      temperature: 0.7,
      maxTokens: 4000,
    })

    // 7. Valider avec Zod
    const result = ReportSchema.parse(rawResult)

    // 8. Appliquer garde-fou sur severity
    const finalSeverity = severityCheck.severity || result.severity

    // 9. Sauvegarder dans BigQuery (agent_insights)
    const runDate = format(new Date(), 'yyyy-MM-dd')
    const insightId = `report-${Date.now()}`

    await insertAgentInsights([{
      id: insightId,
      runDate,
      site: '*global*', // Rapport global
      agent: 'report',
      severity: finalSeverity,
      title: `Rapport hebdo ${context.period.start} → ${context.period.end}`,
      summary: result.summary,
      payload: {
        report_md: result.report_md,
        period: context.period,
        network_summary: context.network_summary,
      },
      evidence: {
        winners: context.winners,
        losers: context.losers,
      },
      suggestedActions: result.actions_top,
      score: result.score,
    }])

    // 10. Push sur Slack (si configuré)
    if (process.env.SLACK_WEBHOOK_URL) {
      log('info', 'Pushing report to Slack...')
      await pushWeeklyReport({
        summary: result.summary,
        topActions: result.actions_top.map(a => ({
          title: a.title,
          site: a.site,
          impact: a.impact,
        })),
        detailsUrl: process.env.DASHBOARD_URL 
          ? `${process.env.DASHBOARD_URL}/insights?agent=report&date=${runDate}`
          : undefined,
      })
    }

    const completedAt = new Date()
    const duration = (completedAt.getTime() - startedAt.getTime()) / 1000

    log('info', `✅ Report Generator completed: ${result.actions_top.length} actions, severity=${finalSeverity}`)

    return {
      agentName: 'report-generator',
      executedAt: startedAt,
      duration,
      status: 'success',
      data: {
        summary: result.summary,
        actions: result.actions_top,
        report_md: result.report_md,
        severity: finalSeverity,
        score: result.score,
        context,
        insight_id: insightId,
      },
    }
  } catch (error: any) {
    log('error', 'Report Generator failed', { error: error.message })

    const completedAt = new Date()
    const duration = (completedAt.getTime() - startedAt.getTime()) / 1000

    return {
      agentName: 'report-generator',
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
  runReportGenerator().then(result => {
    console.log('\n📊 Résultat Report Generator:')
    console.log(`  Status: ${result.status}`)
    console.log(`  Duration: ${result.duration}s`)
    
    if (result.status === 'success') {
      console.log(`  Actions: ${result.data.actions.length}`)
      console.log(`  Severity: ${result.data.severity}`)
      console.log(`  Score: ${result.data.score}`)
      console.log(`\n📝 Summary:\n${result.data.summary}`)
      console.log(`\n📄 Full Report:\n${result.data.report_md}`)
    } else {
      console.log(`  Error: ${result.error}`)
    }

    process.exit(result.status === 'failed' ? 1 : 0)
  })
}

