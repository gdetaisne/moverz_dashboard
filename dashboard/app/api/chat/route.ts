/**
 * API Chat - Endpoint pour chatbot GPT analysant BigQuery
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { route as routeIntent } from './intentRouter'
import { bigquery } from '@/lib/bigquery'

// Helper function pour exécuter des requêtes
async function query(sql: string): Promise<any[]> {
  const [rows] = await bigquery.query({ query: sql })
  return rows
}

export const dynamic = 'force-dynamic'

// OpenAI sera initialisé de manière lazy dans la fonction POST
// pour éviter les erreurs au build time

// ========================================
// PROMPT SYSTÈME
// ========================================

const SYSTEM_PROMPT = `Tu es l’Assistant Moverz.

PRINCIPES
1) Stratégie d’abord, toujours. Chaque réponse commence par un court angle “Stratégie” (2–4 puces).
2) Si, et seulement si, la question nécessite des chiffres issus des sources de données, active le mode Data Moverz.
3) N’invente pas : s’appuyer prioritairement sur dashboard/data/strategy.md + strategy.json.
4) Les données BigQuery ne sont consultées que lorsque l’intention “data” est confirmée ET que Data Moverz est activé.
5) Quand une ressource manque, indique posément quoi brancher (ex: “GA4 export” ou “repo GitHub”) et continue avec une réponse stratégique exploitable.

MODES
- Généraliste (par défaut) : conversation, cadrage, priorisation, décisions, plan d’action. Jamais de SQL.
- Data Moverz : uniquement pour “trafic/404/agents/GSC” etc. Fournis un résumé concis + possibilité de détails via les boutons.

FORMAT DE RÉPONSE
- Section 1 — « Stratégie » : 2–4 puces (hypothèses, décision, next step).
- Section 2 — « Données » : incluse seulement si Data Moverz est actif (≤10 lignes).
- Section 3 — « Prochaines actions » : 2–3 puces actionnables max.

COMPORTEMENTS INTERDITS
- Ne jamais lancer de SQL si l’intention “data” n’est pas confirmée.
- Ne pas afficher les boutons “Détailler / Deepsearch / Data” hors mode Data.
- Pas de bascule implicite vers Data sur un simple “hello”, “merci”, “parle-moi de…”.

RESSOURCES DISPONIBLES
- Stratégie (toujours) : dashboard/data/strategy.md et strategy.json.
- BigQuery (Data Moverz) : gsc_daily_aggregated, gsc_daily_metrics, errors_404_history, agent_insights, agent_runs.
- Fallback 404 : moverz.errors_404_history si analytics_core absent.

SI DOUTE
- Si l’intention est ambiguë (<0.75 de confiance), reste en Généraliste et propose une reformulation en 1 phrase pour préciser le besoin.`

// ========================================
// ENDPOINT POST
// ========================================

async function readStrategyContext(): Promise<{ markdown: string; json: string }> {
  try {
    // Try multiple locations (local build vs prod)
    const bases = [
      path.join(process.cwd(), 'dashboard', 'data'),
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), 'dashboard', 'dashboard', 'data'),
    ]
    let markdown = ''
    let json = ''
    for (const b of bases) {
      if (!markdown) markdown = await fs.readFile(path.join(b, 'strategy.md'), 'utf-8').catch(() => '')
      if (!json) json = await fs.readFile(path.join(b, 'strategy.json'), 'utf-8').catch(() => '')
    }
    // Fallback env
    if (!markdown && process.env.STRATEGY_MD) markdown = process.env.STRATEGY_MD
    if (!json && process.env.STRATEGY_JSON) json = process.env.STRATEGY_JSON
    return { markdown, json }
  } catch {
    return { markdown: '', json: '' }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Vérifier et initialiser OpenAI (lazy, uniquement au runtime)
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 503 }
      )
    }

    // Import dynamique d'OpenAI uniquement au runtime (évite erreur au build)
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const body = await request.json()
    const { message, mode = 'summary', context, dataMode = false } = body as { message: string; mode?: 'summary' | 'detail' | 'deepsearch' | 'data'; context?: any; dataMode?: boolean }

    // Route intent
    const routed = routeIntent(message, dataMode)

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message required' },
        { status: 400 }
      )
    }

    // Détection simple du sujet pour aiguiller le prompt
    const lower = message.toLowerCase()
    // Heuristique de métrique demandée
    const metric: 'impressions' | 'clicks' | 'ctr' | 'position' = /impression/.test(lower)
      ? 'impressions'
      : /ctr/.test(lower)
      ? 'ctr'
      : /position|rank|ranking/.test(lower)
      ? 'position'
      : 'clicks'
    const isDataQuestion = routed.mode === 'data'
    const topic: 'traffic' | '404' | 'agents' = /404|broken|lien cass|crawl/.test(lower)
      ? '404'
      : /agent|insight|run|orchestrator/.test(lower)
      ? 'agents'
      : 'traffic'

    // Généraliste si router dit general
    if (routed.mode !== 'data') {
      const strategy = await readStrategyContext()
      const { default: OpenAI } = await import('openai')
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
      const generalResponse = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'Tu es un assistant business francophone. Tu utilises le contexte Stratégie ci-dessous pour répondre de manière concise (≤10 lignes). Si une info n\'est pas présente, dis-le clairement.' },
          { role: 'system', content: `STRATÉGIE MARKDOWN:\n${strategy.markdown}` },
          { role: 'system', content: `STRATÉGIE JSON:\n${strategy.json}` },
          { role: 'user', content: message },
        ],
        temperature: 0.5,
        max_tokens: 900,
      })
      let analysis = generalResponse.choices[0]?.message?.content || ''
      if (mode === 'summary') {
        analysis = analysis.split('\n').slice(0, 10).join('\n')
      }
      return NextResponse.json({ success: true, data: { sql: null, explanation: null, results: [], rowCount: 0, analysis, error: null, suggestions: [], topic: 'general', mode, extra: { strategyUsed: Boolean(strategy.markdown || strategy.json), routed } } })
    }

    // 1. Appeler GPT pour générer la requête SQL
    console.log('🤖 Asking GPT for SQL query...')
    
    try {
      const chatResponse = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + (mode === 'summary' ? '\n\nCONTRAINTE: La réponse finale utilisateur doit tenir en 10 lignes max.' : '') },
          { role: 'user', content: `[TOPIC=${topic}] [METRIC=${metric}] ${message}` },
        ],
        temperature: 0.1, // Plus bas pour plus de cohérence
        max_tokens: 800,
        response_format: { type: 'json_object' },
      })

      const content = chatResponse.choices[0]?.message?.content
      console.log('GPT Response:', content)

      if (!content) {
        throw new Error('Empty response from GPT')
      }

      // Extraction JSON robuste (tolère ```json ... ```), sinon fallback constructeur SQL simple
      let gptResult: any
      try {
        gptResult = JSON.parse(content)
      } catch {
        const m = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/{[\s\S]*}/)
        if (m) {
          gptResult = JSON.parse(m[1] ? m[1] : m[0])
        } else {
          // Fallback constructeur (topic trafic uniquement)
          const cityMap: Record<string, string> = {
            lyon: 'devis-demenageur-lyon.fr',
            toulouse: 'devis-demenageur-toulousain.fr',
            nantes: 'devis-demenageur-nantes.fr',
            marseille: 'www.bordeaux-demenageur.fr',
            bordeaux: 'www.bordeaux-demenageur.fr',
            nice: 'devis-demenageur-nice.fr',
            strasbourg: 'devis-demenageur-strasbourg.fr',
            rouen: 'devis-demenageur-rouen.fr',
            rennes: 'devis-demenageur-rennes.fr',
            montpellier: 'devis-demenageur-montpellier.fr',
            lille: 'devis-demenageur-lille.fr',
          }
          const foundCity = Object.keys(cityMap).find(c => lower.includes(c))
          const domainFilter = foundCity ? `AND domain = '${cityMap[foundCity]}'` : ''
          const days = /7\s?j|7\s?jours|\b7\b/.test(lower) ? 7 : 30
          const selectExpr = metric === 'impressions' ? 'SUM(impressions) as impressions' : metric === 'ctr' ? 'AVG(ctr) as ctr' : metric === 'position' ? 'AVG(position) as position' : 'SUM(clicks) as clicks'
          gptResult = {
            sql: `SELECT FORMAT_DATE('%Y-%m-%d', date) as date, ${selectExpr}\nFROM \`moverz-dashboard.analytics_core.gsc_daily_aggregated\`\nWHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)\n  AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)\n  ${domainFilter}\nGROUP BY date\nORDER BY date` ,
            explanation: 'Fallback constructeur: évolution des clics sur la période demandée.',
            suggestions: [foundCity ? `Comparer ${foundCity} à la moyenne réseau` : 'Préciser un domaine pour focaliser'],
          }
        }
      }

      let sql = gptResult.sql as string | undefined

      if (!sql) {
        console.warn('No SQL in response, using fallback query')
        // Fallback sécurisé: KPIs 7 jours par domaine
        sql = `SELECT domain, SUM(impressions) AS total_impressions, SUM(clicks) AS total_clicks, AVG(ctr) AS avg_ctr, AVG(position) AS avg_position FROM \`moverz-dashboard.analytics_core.gsc_daily_aggregated\` WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) GROUP BY domain ORDER BY total_impressions DESC LIMIT 20`
        gptResult = {
          explanation: gptResult?.explanation || 'Fallback appliqué: KPIs globaux sur 7 jours par domaine.',
          suggestions: gptResult?.suggestions || [
            'Précisez un domaine (ex: "toulousain") pour une évolution temporelle',
            'Demandez une comparaison 7j vs 7j précédents',
          ],
        }
      }

      console.log('📊 Generated SQL:', sql)

      // 2. Exécuter la requête BigQuery (avec fallback dataset pour 404) — Data Gate
      let data = []
      let error = null

      try {
        data = await query(sql)
        console.log(`✅ Query executed: ${data.length} rows returned`)
      } catch (queryError: any) {
        console.error('❌ Query error:', queryError.message)
        // Fallback si la table errors_404_history n'existe pas dans analytics_core
        const notFound = /Not found: Table .*errors_404_history/i.test(queryError.message || '')
        const targetsAnalyticsCore = /analytics_core\.errors_404_history/.test(sql)
        if (notFound && targetsAnalyticsCore) {
          const fallbackSql = sql.replace(/moverz-dashboard\.analytics_core\.errors_404_history/g, 'moverz.errors_404_history')
          console.warn('🔁 Retrying with fallback dataset for errors_404_history:', fallbackSql)
          try {
            data = await query(fallbackSql)
            sql = fallbackSql
            error = null
            console.log(`✅ Fallback query executed: ${data.length} rows returned`)
            // Enrichir l'explication
            gptResult.explanation = (gptResult.explanation ? gptResult.explanation + '\n' : '') +
              'Note: dataset fallback appliqué vers `moverz.errors_404_history`.'
          } catch (fallbackErr: any) {
            console.error('❌ Fallback query error:', fallbackErr.message)
            error = fallbackErr.message
          }
        } else {
          error = queryError.message
        }
      }

      // 2.b Deepsearch: exécuter des requêtes supplémentaires selon le sujet
      const extra: Record<string, any> = {}
      if (!error && mode === 'deepsearch') {
        try {
          if (topic === '404') {
            const q1 = 'SELECT DATE(scan_date) AS date, AVG(total_errors_404) AS avg_404 FROM `moverz-dashboard.analytics_core.errors_404_history` WHERE scan_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) GROUP BY DATE(scan_date) ORDER BY date DESC LIMIT 30'
            const q1rows = await query(q1).catch(async () => await query(q1.replace(/moverz-dashboard\.analytics_core\.errors_404_history/g, 'moverz.errors_404_history')))
            extra.timeseries_404 = q1rows
          } else if (topic === 'traffic') {
            const q2 = 'SELECT domain, SUM(clicks) AS clicks, SUM(impressions) AS impressions FROM `moverz-dashboard.analytics_core.gsc_daily_aggregated` WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY) GROUP BY domain ORDER BY impressions DESC LIMIT 20'
            extra.top_sites = await query(q2)
          } else if (topic === 'agents') {
            const q3 = 'SELECT agent_name, COUNT(*) AS runs, ROUND(AVG(duration_seconds),2) AS avg_s, ROUND(COUNTIF(status="success")/COUNT(*)*100,1) AS success_rate FROM `moverz-dashboard.analytics_core.agent_runs` WHERE executed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY) GROUP BY agent_name ORDER BY runs DESC'
            extra.agent_stats = await query(q3)
          }
        } catch (e: any) {
          console.warn('Deepsearch extra queries failed:', e?.message)
        }
      }

      // 3. Analyser les résultats avec GPT (enrichi du contexte Stratégie si disponible)
      let analysis = null
      
      if (!error && data.length > 0) {
        console.log('🧠 Analyzing results with GPT...')
        
        const analysisPrompt = `
Tu es un expert en analytics web et SEO pour des sites de déménagement.

Question posée: "${message}"

Résultats de la requête BigQuery:
${JSON.stringify(data, null, 2)}

INSTRUCTIONS CRITIQUES:
1. Toujours inclure les CHIFFRES EXACTS avec notation: "(X -> Y)"
2. Toujours calculer et afficher les VARIATIONS: "(+X% ou -X%)"
3. Être DENSE et DOCUMENTÉ: donner faits, contexte, interprétation
4. Utiliser format: "En baisse de 15% (120 → 103 imp)" pour les comparaisons
5. Ajouter contexte sur CE QUE ÇA SIGNIFIE
6. Proposer ACTIONS si pertinent

Exemple de bonne réponse (format requis):
"
📊 **Résumé**
Marseille: en baisse de 15% (8,420 → 7,156 imp/jour). Perte de 1,264 impressions quotidiennes.

🔍 **Interprétation**
Cette baisse suggère une régression SEO: le site apparaît moins souvent dans les résultats Google. Sur 7 jours, cela représente ~8,848 impressions perdues. Cette chute peut indiquer:
- Désindexation de pages
- Perte de ranking sur mots-clés importants  
- Impact d'une mise à jour technique récente

💡 **Action recommandée**
Vérifier les 10 dernières mises à jour, audits crawl/404, positions historiques sur top 20 kw.
"

Exemple de mauvaise réponse:
"Analyse complétée."
`

      const strategy = await readStrategyContext()
      const analysisResponse = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert analytics et business qui explique les données clairement en français. Utilise le contexte Stratégie si pertinent pour interpréter (ne pas inventer).',
          },
          { role: 'system', content: strategy.markdown ? `STRATÉGIE MARKDOWN:\n${strategy.markdown}` : '' },
          { role: 'system', content: strategy.json ? `STRATÉGIE JSON:\n${strategy.json}` : '' },
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      })

      let analysisText = analysisResponse.choices[0]?.message?.content || ''
      if (mode === 'summary') {
        // Sécurité: tronquer à 10 lignes max côté API
        const lines = analysisText.split('\n')
        analysisText = lines.slice(0, 10).join('\n')
      }
      analysis = analysisText
      console.log('✅ Analysis generated')
    } else if (error) {
      analysis = `❌ Erreur lors de l'exécution de la requête: ${error}\n\nJe ne peux pas analyser les données car la requête a échoué.`
    } else {
      analysis = `Aucune donnée trouvée pour votre question.\n\nEssayez de reformuler votre question ou d'utiliser des critères différents.`
      }

      // 4. Retourner la réponse
      return NextResponse.json({
      success: true,
      data: {
        sql,
        explanation: gptResult.explanation,
        results: data,
        rowCount: data.length,
        analysis,
        error,
        suggestions: gptResult.suggestions || [],
        topic,
        mode: 'data',
        extra: { ...extra, routed },
      },
      })

    } catch (gptError: any) {
      console.error('❌ GPT API error:', gptError)
      return NextResponse.json({
        success: false,
        error: `Erreur lors de la génération de la requête: ${gptError.message}`,
      })
    }

  } catch (error: any) {
    console.error('❌ Chat API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

