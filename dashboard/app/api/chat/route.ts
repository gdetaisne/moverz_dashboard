/**
 * API Chat - Endpoint pour chatbot GPT analysant BigQuery
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { query } from '../../../../agents/shared/bigquery-tools.js'

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
      
      const analysisResponse = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'Tu analyses des données analytiques et fournis des insights clairs et actionnables. Réponds en français.',
          },
          {
            role: 'user',
            content: `Question: ${message}\n\nRésultats:\n${JSON.stringify(data, null, 2)}\n\nDonne-moi une analyse claire et des recommandations.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
      })

      analysis = analysisResponse.choices[0]?.message?.content
      console.log('✅ Analysis generated')
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

