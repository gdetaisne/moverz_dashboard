/**
 * Agent GSC Issues Analyzer - Analyse et synthétise les problèmes d'indexation
 * Déclenché automatiquement après chaque mise à jour ETL GSC Issues
 */

import 'dotenv/config'
import { chatWithJSON } from '../shared/openai-client.js'
import type { AgentResult } from '../core/types.js'
import { log } from '../../etl/shared/error-handler.js'
import { insertAgentInsights } from '../../etl/shared/bigquery-client.js'
import { query } from '../../etl/shared/bigquery-client.js'

// ========================================
// PROMPT
// ========================================

const SYSTEM_PROMPT = `
Tu es un expert SEO spécialisé dans l'analyse des problèmes d'indexation Google Search Console.

Ton rôle :
1. Analyser les problèmes d'indexation détectés (erreurs, avertissements)
2. REGROUPER les problèmes par TYPE (indexing, coverage, sitemap, robots.txt, etc.)
3. Identifier les patterns et tendances
4. Prioriser les actions selon l'impact et l'urgence
5. Fournir des recommandations actionnables et structurées pour correction technique

Tu retournes UNIQUEMENT du JSON valide avec cette structure :
{
  "summary": "Résumé exécutif des problèmes (max 200 mots)",
  "grouped_by_type": {
    "indexing": {
      "total_count": 10,
      "total_pages_affected": 25,
      "domains_affected": ["site1.fr", "site2.fr"],
      "common_causes": ["Description des causes communes"],
      "priority": "critical" | "high" | "medium" | "low",
      "technical_fix": "Description technique précise de la correction à appliquer",
      "code_examples": ["Exemple de code ou configuration si applicable"],
      "files_to_modify": ["Liste des fichiers/chemins à modifier si connu"],
      "affected_urls_sample": ["URL1", "URL2", "..."],
      "issues": [
        {
          "domain": "nom-du-site.fr",
          "severity": "error" | "warning",
          "count": 5,
          "title": "Titre du problème",
          "description": "Description détaillée"
        }
      ]
    },
    "coverage": { ... },
    "other_type": { ... }
  },
  "priority_actions": [
    {
      "type": "indexing" | "coverage" | "other",
      "domain": "nom-du-site.fr" | "*global*",
      "action": "Action concrète à entreprendre",
      "technical_details": "Détails techniques pour implémenter la correction",
      "urgency": "critical" | "high" | "medium" | "low",
      "estimated_effort": "low" | "medium" | "high"
    }
  ],
  "trends": [
    "Observation 1 sur l'évolution",
    "Observation 2 sur les patterns"
  ],
  "global_score": 0.0-1.0,
  "severity": "info" | "warn" | "critical"
}

Règles IMPORTANTES :
- REGROUPER TOUS les problèmes similaires par TYPE dans "grouped_by_type"
- Prioriser les erreurs critiques (severity: error)
- Pour chaque type, fournir des détails techniques exploitables
- Inclure des exemples de code/configuration si applicable
- Identifier les fichiers/chemins à modifier si possible
- Severity global : "critical" si >10 erreurs, "warn" si >20 warnings, "info" sinon
- Les "technical_fix" doivent être suffisamment détaillés pour être implémentés directement
`

// ========================================
// FONCTIONS HELPER
// ========================================

async function getGSCIssuesSummary(days: number = 7) {
  const sql = `
    SELECT 
      domain,
      issue_type,
      severity,
      status,
      COUNT(DISTINCT id) as issue_count,
      SUM(affected_pages_count) as total_affected_pages
    FROM \`${process.env.GCP_PROJECT_ID || 'moverz-dashboard'}.${process.env.BQ_DATASET || 'analytics_core'}.gsc_issues\`
    WHERE issue_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
      AND status = 'open'
    GROUP BY domain, issue_type, severity, status
    ORDER BY 
      CASE severity 
        WHEN 'error' THEN 1 
        WHEN 'warning' THEN 2 
        ELSE 3 
      END,
      issue_count DESC
  `

  return query(sql)
}

async function getGSCIssuesByDomain(days: number = 7) {
  const sql = `
    SELECT 
      domain,
      issue_type,
      severity,
      title,
      description,
      affected_pages_count,
      detected_at,
      COUNT(*) OVER (PARTITION BY domain, issue_type, severity) as similar_issues_count
    FROM \`${process.env.GCP_PROJECT_ID || 'moverz-dashboard'}.${process.env.BQ_DATASET || 'analytics_core'}.gsc_issues\`
    WHERE issue_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
      AND status = 'open'
    ORDER BY 
      CASE severity 
        WHEN 'error' THEN 1 
        WHEN 'warning' THEN 2 
        ELSE 3 
      END,
      detected_at DESC
    LIMIT 100
  `

  return query(sql)
}

async function getGSCIssuesTrend(days: number = 30) {
  const sql = `
    SELECT 
      DATE(issue_date) as date,
      severity,
      COUNT(DISTINCT id) as issue_count
    FROM \`${process.env.GCP_PROJECT_ID || 'moverz-dashboard'}.${process.env.BQ_DATASET || 'analytics_core'}.gsc_issues\`
    WHERE issue_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
    GROUP BY DATE(issue_date), severity
    ORDER BY date DESC, severity
  `

  return query(sql)
}

// ========================================
// AGENT
// ========================================

export async function runGSCIssuesAnalyzer(): Promise<AgentResult> {
  const startedAt = new Date()
  log('info', '🔍 Starting GSC Issues Analyzer Agent...')

  try {
    // 1. Collecter les données
    const [summary, issues, trends] = await Promise.all([
      getGSCIssuesSummary(7),
      getGSCIssuesByDomain(7),
      getGSCIssuesTrend(30),
    ])

    if (!summary || summary.length === 0) {
      log('info', 'No GSC issues found, skipping analysis')
      return {
        status: 'success',
        agent: 'gsc-issues-analyzer',
        insights: [],
        message: 'Aucun problème détecté',
        duration: Date.now() - startedAt.getTime(),
      }
    }

    // 2. Préparer le contexte pour GPT
    const totalErrors = summary.filter((s: any) => s.severity === 'error').reduce((sum: number, s: any) => sum + Number(s.issue_count || 0), 0)
    const totalWarnings = summary.filter((s: any) => s.severity === 'warning').reduce((sum: number, s: any) => sum + Number(s.issue_count || 0), 0)
    const totalIssues = totalErrors + totalWarnings

    const context = {
      summary: summary.slice(0, 50), // Limiter pour éviter token limit
      issues: issues.slice(0, 50),
      trends: trends.slice(0, 30),
      totals: {
        errors: totalErrors,
        warnings: totalWarnings,
        total: totalIssues,
      },
    }

    const userMessage = `
Analyse ces problèmes d'indexation Google Search Console détectés sur les 7 derniers jours :

## Résumé global
- Erreurs totales: ${totalErrors}
- Avertissements totaux: ${totalWarnings}
- Total issues: ${totalIssues}

## Détails par domaine et type
${JSON.stringify(context.summary, null, 2)}

## Issues détaillées (échantillon)
${JSON.stringify(context.issues.slice(0, 20), null, 2)}

## Évolution sur 30 jours
${JSON.stringify(context.trends, null, 2)}

Génère une analyse synthétique avec :
1. Un résumé des problèmes principaux
2. REGROUPEMENT PAR TYPE de problème dans "grouped_by_type" :
   - Pour chaque type, le nombre total d'issues
   - Les domaines affectés
   - Les causes communes
   - Les corrections techniques détaillées
   - Les exemples de code/configuration si applicable
   - Les fichiers à modifier si connu
3. Les actions prioritaires avec détails techniques pour correction
4. Les tendances observées
5. Un score global de santé SEO (0-1)

IMPORTANT : Le regroupement par type doit permettre d'identifier facilement les corrections à appliquer en masse sur tous les sites affectés.
`

    // 3. Appeler GPT-4
    const result = await chatWithJSON<{
      summary: string
      grouped_by_type: Record<string, {
        total_count: number
        total_pages_affected: number
        domains_affected: string[]
        common_causes: string[]
        priority: 'critical' | 'high' | 'medium' | 'low'
        technical_fix: string
        code_examples?: string[]
        files_to_modify?: string[]
        affected_urls_sample?: string[]
        issues: Array<{
          domain: string
          severity: string
          count: number
          title: string
          description: string
        }>
      }>
      priority_actions: Array<{
        type: string
        domain: string
        action: string
        technical_details: string
        urgency: 'critical' | 'high' | 'medium' | 'low'
        estimated_effort: 'low' | 'medium' | 'high'
      }>
      trends: string[]
      global_score: number
      severity: 'info' | 'warn' | 'critical'
    }>(SYSTEM_PROMPT, userMessage, {
      model: 'gpt-4',
      temperature: 0.5,
      maxTokens: 3000,
    })

    if (!result || !result.summary) {
      throw new Error('Invalid response from OpenAI')
    }

    // 4. Créer l'insight global
    const runDate = new Date().toISOString().split('T')[0]
    const insightId = `gsc-issues-${Date.now()}`
    
    const globalInsight = {
      id: insightId,
      runDate,
      agent: 'gsc-issues-analyzer',
      site: '*global*',
      severity: result.severity || (totalErrors > 10 ? 'critical' : totalWarnings > 20 ? 'warn' : 'info'),
      title: `Analyse des problèmes d'indexation (${totalIssues} issues détectés)`,
      summary: result.summary,
      payload: {
        total_errors: totalErrors,
        total_warnings: totalWarnings,
        total_issues: totalIssues,
      },
      evidence: {
        grouped_by_type: result.grouped_by_type || {},
        trends: result.trends || [],
      },
      suggestedActions: (result.priority_actions || []).map((action) => ({
        priority: action.urgency || 'medium',
        title: action.action,
        site: action.domain,
        impact: action.technical_details,
        effort: action.estimated_effort || 'medium',
        type: action.type,
      })),
      score: result.global_score || (totalErrors > 0 ? 0.3 : totalWarnings > 10 ? 0.6 : 0.8),
    }

    // 5. Stocker dans BigQuery
    await insertAgentInsights([globalInsight])

    log('info', '✅ GSC Issues Analyzer completed', {
      issues_analyzed: totalIssues,
      priority_issues: result.priority_issues?.length || 0,
      severity: globalInsight.severity,
    })

    return {
      status: 'success',
      agent: 'gsc-issues-analyzer',
      insights: [globalInsight],
      message: `${totalIssues} issues analysés, ${result.priority_issues?.length || 0} prioritaires identifiés`,
      duration: Date.now() - startedAt.getTime(),
    }
  } catch (error: any) {
    log('error', '❌ GSC Issues Analyzer failed', { error: error.message, stack: error.stack })
    return {
      status: 'error',
      agent: 'gsc-issues-analyzer',
      insights: [],
      message: error.message,
      duration: Date.now() - startedAt.getTime(),
    }
  }
}

// Exporter pour être utilisable comme module
export { runGSCIssuesAnalyzer as analyzeGSCIssues }

