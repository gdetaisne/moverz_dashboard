/**
 * API Chat - Endpoint pour chatbot GPT analysant BigQuery
 */

import { NextRequest, NextResponse } from 'next/server'
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

const SYSTEM_PROMPT = `
Tu es un expert SQL pour BigQuery analysant les données Google Search Console de Moverz.

BASE DE DONNÉES:
- Project: moverz-dashboard
- Dataset: analytics_core
- Table: \`moverz-dashboard.analytics_core.gsc_daily_aggregated\`
- Colonnes: date (DATE), domain (STRING), clicks (INT64), impressions (INT64), ctr (FLOAT64), position (FLOAT64)

Note: la colonne est "domain" pas "site" dans cette table.

SITES: devis-demenageur-marseille.fr, devis-demenageur-toulousain.fr, devis-demenageur-lyon.fr, www.bordeaux-demenageur.fr, devis-demenageur-nantes.fr, devis-demenageur-lille.fr, devis-demenageur-nice.fr, devis-demenageur-strasbourg.fr, devis-demenageur-rouen.fr, devis-demenageur-rennes.fr, devis-demenageur-montpellier.fr

TÂCHE:
Génère UNIQUEMENT du JSON valide avec cette structure:
{
  "sql": "SELECT domain, date, impressions, clicks, ctr, position FROM \`moverz-dashboard.analytics_core.gsc_daily_aggregated\` WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) LIMIT 100",
  "explanation": "Cette requête...",
  "suggestions": []
}

RÈGLES CRITIQUES:
1. Nom de table EXACT: moverz-dashboard.analytics_core.gsc_daily_aggregated
2. Colonne "domain" (pas "site")
3. Toujours WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL X DAY)
4. LIMIT 100 max
5. GROUP BY domain, date quand pertinent

EXEMPLES BONNES REQUÊTES:

Question: "Quels sites ont le plus d'impressions ?"
SQL: "SELECT domain, SUM(impressions) as total_impressions FROM \`moverz-dashboard.analytics_core.gsc_daily_aggregated\` WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) GROUP BY domain ORDER BY total_impressions DESC LIMIT 10"

Question: "Evolution du trafic à Toulouse ?"
SQL: "SELECT date, SUM(clicks) as clicks FROM \`moverz-dashboard.analytics_core.gsc_daily_aggregated\` WHERE domain = 'devis-demenageur-toulousain.fr' AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) GROUP BY date ORDER BY date"

Question: "Comparer les sites cette semaine ?"
SQL: "SELECT domain, SUM(impressions) as imp, SUM(clicks) as clics FROM \`moverz-dashboard.analytics_core.gsc_daily_aggregated\` WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) GROUP BY domain ORDER BY imp DESC"
`

// ========================================
// ENDPOINT POST
// ========================================

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
    const { message, context } = body

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message required' },
        { status: 400 }
      )
    }

    // 1. Appeler GPT pour générer la requête SQL
    console.log('🤖 Asking GPT for SQL query...')
    
    try {
      const chatResponse = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message },
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

      // Extraction JSON robuste (tolère ```json ... ```)
      let gptResult: any
      try {
        gptResult = JSON.parse(content)
      } catch {
        const m = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/{[\s\S]*}/)
        if (!m) throw new Error('Failed to parse GPT JSON response')
        gptResult = JSON.parse(m[1] ? m[1] : m[0])
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

      // 2. Exécuter la requête BigQuery
      let data = []
      let error = null

      try {
        data = await query(sql)
        console.log(`✅ Query executed: ${data.length} rows returned`)
      } catch (queryError: any) {
        console.error('❌ Query error:', queryError.message)
        error = queryError.message
      }

      // 3. Analyser les résultats avec GPT
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

      const analysisResponse = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert analytics qui explique les données de manière claire et pédagogique. Tu réponds TOUJOURS en français.',
          },
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      })

      analysis = analysisResponse.choices[0]?.message?.content
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

