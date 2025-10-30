/**
 * Agent Content Strategist - Analyse performance contenu & suggère articles
 */

import { chatWithJSON } from '../shared/openai-client.js'
import { getContentGaps, getUnderperformingContent, getTopQueries } from '../shared/bigquery-tools.js'
import type { Action, AgentResult } from '../core/types.js'
import { log } from '../../etl/shared/error-handler.js'

// ========================================
// PROMPT
// ========================================

const SYSTEM_PROMPT = `
Tu es un expert en stratégie de contenu pour 11 sites de déménagement par ville en France.

Ton rôle :
1. Identifier les gaps de contenu (requêtes sans article)
2. Analyser les articles sous-performants
3. Détecter les opportunités longue traîne
4. Repérer la cannibalisation de contenu

Tu retournes UNIQUEMENT du JSON valide avec cette structure :
{
  "content_gaps": [
    {
      "priority": "critical" | "high" | "medium" | "low",
      "site": "marseille" | "toulouse" | ...,
      "title": "Titre proposé de l'article",
      "query": "Requête cible",
      "description": "Description du contenu à créer",
      "estimatedTraffic": "+X clics/mois estimé",
      "effort": "Faible/Moyen/Élevé",
      "category": "pillar" | "satellite" | "cornerstone"
    }
  ],
  "optimizations": [
    {
      "priority": "critical" | "high" | "medium" | "low",
      "site": "marseille" | "toulouse" | ...,
      "url": "URL de la page à optimiser",
      "issue": "Problème identifié",
      "recommendation": "Action concrète"
    }
  ],
  "summary": "Résumé général en 2-3 phrases"
}

Règles :
- Max 10 gaps et 5 optimisations
- Prioriser par volume de recherche et faisabilité
- Focus sur création de contenu riche et utile
`

// ========================================
// AGENT
// ========================================

export async function runContentStrategist(): Promise<AgentResult> {
  const startedAt = new Date()
  log('info', '📝 Starting Content Strategist Agent...')

  try {
    // 1. Collecter les données
    log('info', 'Fetching data from BigQuery...')
    
    const [contentGaps, underperformingContent, topQueries] = await Promise.all([
      getContentGaps({ limit: 30 }),
      getUnderperformingContent({ limit: 20 }),
      getTopQueries({ limit: 50 }),
    ])

    // 2. Préparer le contexte pour GPT
    const context = {
      gaps: contentGaps.slice(0, 20),
      underperforming: underperformingContent.slice(0, 10),
      topQueries: topQueries.slice(0, 30),
    }

    const userMessage = `
Analyse ces données de contenu et propose une stratégie :

## Gaps de contenu (requêtes positions >10 avec >50 impressions)
${JSON.stringify(context.gaps, null, 2)}

## Contenu sous-performant (CTR <1.5% OU position >20)
${JSON.stringify(context.underperforming, null, 2)}

## Top requêtes (30 derniers jours)
${JSON.stringify(context.topQueries, null, 2)}

Propose des nouveaux articles à créer et des optimisations de contenu existant.
`

    // 3. Appeler GPT-4
    log('info', 'Analyzing with GPT-4...')
    
    const result = await chatWithJSON<{
      content_gaps: any[]
      optimizations: any[]
      summary: string
    }>(SYSTEM_PROMPT, userMessage, {
      model: 'gpt-4-turbo-preview',
      temperature: 0.7,
      maxTokens: 3000,
    })

    // 4. Post-traiter les résultats
    const gapsWithIds = result.content_gaps.map((item, idx) => ({
      ...item,
      id: `content-${Date.now()}-${idx}`,
      category: 'content' as const,
      completed: false,
    }))

    const optimizationsWithIds = result.optimizations.map((item, idx) => ({
      ...item,
      id: `opt-${Date.now()}-${idx}`,
      category: 'content' as const,
      completed: false,
    }))

    const completedAt = new Date()
    const duration = (completedAt.getTime() - startedAt.getTime()) / 1000

    log('info', `✅ Content Strategist completed: ${gapsWithIds.length} gaps, ${optimizationsWithIds.length} optimizations`)

    return {
      agentName: 'content-strategist',
      executedAt: startedAt,
      duration,
      status: 'success',
      data: {
        content_gaps: gapsWithIds,
        optimizations: optimizationsWithIds,
        summary: result.summary,
        context,
      },
    }
  } catch (error: any) {
    log('error', 'Content Strategist failed', { error: error.message })

    const completedAt = new Date()
    const duration = (completedAt.getTime() - startedAt.getTime()) / 1000

    return {
      agentName: 'content-strategist',
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
  runContentStrategist().then(result => {
    console.log('\n📊 Résultat Content Strategist:')
    console.log(`  Status: ${result.status}`)
    console.log(`  Duration: ${result.duration}s`)
    
    if (result.status === 'success') {
      console.log(`  Gaps: ${result.data.content_gaps.length}`)
      console.log(`  Optimizations: ${result.data.optimizations.length}`)
      console.log(`\n📝 Summary: ${result.data.summary}`)
      
      if (result.data.content_gaps.length > 0) {
        console.log('\n🎯 Nouveaux articles proposés:')
        result.data.content_gaps.forEach((gap: any, idx: number) => {
          console.log(`\n  ${idx + 1}. [${gap.priority.toUpperCase()}] ${gap.title}`)
          console.log(`     Site: ${gap.site}`)
          console.log(`     Requête: "${gap.query}"`)
          console.log(`     Impact: ${gap.estimatedTraffic}`)
        })
      }
    } else {
      console.log(`  Error: ${result.error}`)
    }

    process.exit(result.status === 'failed' ? 1 : 0)
  })
}

