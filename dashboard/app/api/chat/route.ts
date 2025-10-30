/**
 * API Chat - Endpoint pour chatbot GPT analysant BigQuery
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { bigquery } from '@/lib/bigquery'

// Helper function pour exécuter des requêtes
async function query(sql: string): Promise<any[]> {
  const [rows] = await bigquery.query({ query: sql })
  return rows
}

export const dynamic = 'force-dynamic'

// Initialiser OpenAI
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY not found - Chat will be disabled')
}

// ========================================
// PROMPT SYSTÈME
// ========================================

const SYSTEM_PROMPT = `
Tu es un assistant analytique expert pour Moverz, réseau de 11 sites de déménagement par ville en France.

Rôle: Analyser les données de trafic organique (impressions, clics, CTR, position) depuis Google Search Console.

Tables disponibles dans BigQuery:
- \`moverz.gsc_global\`: Métriques quotidiennes par site (impressions, clics, CTR, position)
- \`moverz.gsc_pages\`: Performance par page
- \`moverz.gsc_queries\`: Performance par requête/keyword
- \`moverz.web_vitals\`: Métriques de performance (LCP, CLS, INP)

Sites disponibles (11 villes):
- marseille, toulouse, lyon, bordeaux, nantes, lille, nice, strasbourg, rouen, rennes, montpellier

TON ROLE:
1. Comprendre les questions de l'utilisateur sur les données
2. Générer une requête SQL BigQuery appropriée
3. Analyser les résultats
4. Fournir une réponse claire et actionnable

RÈGLES:
- Réponds UNIQUEMENT en JSON avec cette structure:
{
  "sql": "SELECT ... FROM moverz.gsc_global WHERE ...",
  "explanation": "Cette requête permet de...",
  "suggestions": ["Idée 1", "Idée 2"]
}

- Les requêtes doivent être optimisées (LIMIT, WHERE date >= DATE_SUB(...))
- Focus sur les 30 derniers jours par défaut
- Utilise les colonnes: site, date, impressions, clicks, ctr, position
`

// ========================================
// ENDPOINT POST
// ========================================

export async function POST(request: NextRequest) {
  try {
    // Vérifier OpenAI
    if (!openai) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 503 }
      )
    }

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
    
    const chatResponse = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    })

    const gptResult = JSON.parse(chatResponse.choices[0]?.message?.content || '{}')
    const sql = gptResult.sql

    if (!sql) {
      return NextResponse.json({
        success: false,
        error: 'No SQL query generated',
        explanation: gptResult.explanation,
      })
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

  } catch (error: any) {
    console.error('❌ Chat API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

