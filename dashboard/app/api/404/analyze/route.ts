import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/404/analyze
 * Analyse GPT-4 des patterns 404
 */

interface AnalyzeRequest {
  results: Array<{
    site: string
    errors_list: string[]
    broken_links_list?: Array<{ source: string; target: string }>
  }>
}

interface Pattern {
  type: string
  description: string
  count: number
  examples: string[]
  severity: 'critical' | 'high' | 'medium' | 'low'
}

interface Fix {
  priority: 'P1' | 'P2' | 'P3'
  title: string
  description: string
  affected_sites: string[]
  affected_count: number
  action: string
  estimated_effort: 'Faible' | 'Moyen' | 'Élevé'
}

interface AnalysisResult {
  summary: string
  total_errors: number
  patterns: Pattern[]
  fixes: Fix[]
  insights: string[]
}

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `Tu es un expert en analyse de sites web et d'erreurs 404.

Ton rôle :
1. Analyser les URLs 404 pour identifier les PATTERNS communs (pas site par site)
2. Regrouper les erreurs par type de problème
3. Proposer des correctifs concrets par ordre de PRIORITÉ

Tu retournes UNIQUEMENT du JSON valide avec cette structure :
{
  "summary": "Résumé en 2-3 phrases de la situation globale",
  "total_errors": number,
  "patterns": [
    {
      "type": "nom_du_pattern",
      "description": "Description du pattern détecté",
      "count": number,
      "examples": ["url1", "url2", "url3"],
      "severity": "critical" | "high" | "medium" | "low"
    }
  ],
  "fixes": [
    {
      "priority": "P1" | "P2" | "P3",
      "title": "Titre court du correctif",
      "description": "Description détaillée du problème",
      "affected_sites": ["site1.fr", "site2.fr"],
      "affected_count": number,
      "action": "Action concrète à réaliser",
      "estimated_effort": "Faible" | "Moyen" | "Élevé"
    }
  ],
  "insights": [
    "Insight 1 : observation intéressante",
    "Insight 2 : tendance détectée"
  ]
}

PATTERNS COURANTS À DÉTECTER :
- Pages blog supprimées (ex: /blog/ancien-article)
- Anciennes pages de service (ex: /services/vieux-nom)
- Erreurs de typo dans les liens (ex: /contacT au lieu de /contact)
- Liens vers anciennes structures d'URL
- Pages avec accents mal encodés
- Pagination cassée (ex: /blog/page/999)
- Fichiers assets manquants (ex: /images/old-logo.png)

RÈGLES :
- Max 5-6 patterns différents
- Max 8 fixes priorisés (4 P1, 2-3 P2, 1-2 P3)
- Fixes concrets et actionnables
- P1 = impact élevé + effort faible
- Regrouper les erreurs similaires (pas lister toutes les URLs)
- Focus sur les actions qui résolvent le PLUS d'erreurs
`

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json()
    
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'OpenAI API key not configured',
          message: 'L\'analyse IA nécessite une clé OpenAI API' 
        },
        { status: 500 }
      )
    }
    
    // Import dynamique d'OpenAI uniquement au runtime (évite erreur au build)
    const { default: OpenAI } = await import('openai')
    
    // Instanciation lazy d'OpenAI (seulement au runtime, pas au build)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
    
    // Collecter toutes les erreurs
    const allErrors: Array<{ site: string; url: string }> = []
    const allBrokenLinks: Array<{ site: string; source: string; target: string }> = []
    
    body.results.forEach(result => {
      result.errors_list.forEach(url => {
        allErrors.push({ site: result.site, url })
      })
      
      result.broken_links_list?.forEach(link => {
        allBrokenLinks.push({
          site: result.site,
          source: link.source,
          target: link.target,
        })
      })
    })
    
    if (allErrors.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: 'Aucune erreur 404 détectée. Excellent travail ! 🎉',
          total_errors: 0,
          patterns: [],
          fixes: [],
          insights: ['Tous les sites sont en bonne santé', 'Aucun lien cassé détecté'],
        },
      })
    }
    
    // Limiter le contexte envoyé à GPT (max 100 erreurs pour éviter token overflow)
    const sampledErrors = allErrors.slice(0, 100)
    const sampledBrokenLinks = allBrokenLinks.slice(0, 50)
    
    const userMessage = `
Analyse ces erreurs 404 détectées sur 11 sites de déménagement :

## Erreurs 404 (${allErrors.length} total, échantillon de ${sampledErrors.length})
${sampledErrors.map(e => `- ${e.site}: ${e.url}`).join('\n')}

## Liens cassés (${allBrokenLinks.length} total, échantillon de ${sampledBrokenLinks.length})
${sampledBrokenLinks.map(l => `- ${l.site}: ${l.source} → ${l.target}`).join('\n')}

Analyse les PATTERNS communs et propose des correctifs concrets par ordre de priorité.
`
    
    console.log('🤖 Sending analysis request to GPT-4...')
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    })
    
    const analysisText = completion.choices[0].message.content
    if (!analysisText) {
      throw new Error('No response from OpenAI')
    }
    
    const analysis: AnalysisResult = JSON.parse(analysisText)
    
    console.log('✅ Analysis completed:', {
      patterns: analysis.patterns.length,
      fixes: analysis.fixes.length,
    })
    
    return NextResponse.json({
      success: true,
      data: analysis,
      meta: {
        total_errors_analyzed: allErrors.length,
        total_broken_links: allBrokenLinks.length,
        sampled: sampledErrors.length < allErrors.length,
      },
    })
    
  } catch (error: any) {
    console.error('❌ Analysis error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        message: 'Erreur lors de l\'analyse IA',
      },
      { status: 500 }
    )
  }
}

