/**
 * Utilitaires pour l'analyse SERP
 */

import { getBigQueryClient, BQ_PROJECT_ID, BQ_DATASET } from './bigquery'

const bigquery = getBigQueryClient()
const location = process.env.BQ_LOCATION || 'europe-west1'

export function inferIntentFromContent(
  pageUrl: string,
  title: string | null,
  description: string | null
): string | null {
  // Ordre : URL > Titre > Description
  const urlLower = pageUrl.toLowerCase()
  const titleLower = (title || '').toLowerCase()
  const descLower = (description || '').toLowerCase()
  const allText = `${urlLower} ${titleLower} ${descLower}`
  
  // Transactional (prioritaire)
  if (/devis|prix|tarif|tarifs|acheter|commander|reserver|estimation|demander|formulaire|contact/.test(allText)) {
    return 'transactional'
  }
  
  // Commercial
  if (/comparer|meilleur|meilleurs|avis|test|top|choisir/.test(allText)) {
    return 'commercial'
  }
  
  // Informational
  if (/guide|comment|qu'est-ce|pourquoi|tutoriel|article|blog|conseil|astuce/.test(allText)) {
    return 'informational'
  }
  
  // Navigational (détection fine)
  if (/contact|accueil|home|index|a-propos|about/.test(urlLower) && urlLower.split('/').filter(Boolean).length <= 2) {
    return 'navigational'
  }
  
  return null // Incertain
}

export function calculateIntentMatchScore(declared: string | null, inferred: string | null): number {
  if (!declared && !inferred) return 50 // Incertain (pas assez de données)
  if (!declared) return 50 // Intent non déclaré = incertain
  if (!inferred) return 50 // Impossible à déduire = incertain
  
  return declared.toLowerCase() === inferred.toLowerCase() ? 100 : 0
}

export function calculateLengthScore(title: string | null, description: string | null): number {
  // Seuils conservateurs (éviter troncature)
  const TITLE_MAX = 55 // Google tronque souvent avant 60
  const DESC_MAX = 150 // Idem pour 155
  
  let titleOK = false
  let descOK = false
  
  if (title) {
    titleOK = title.length <= TITLE_MAX
  }
  
  if (description) {
    descOK = description.length <= DESC_MAX
  }
  
  // Binaire : 100% si les 2 OK, 0% si aucun, 50% si un seul ou incertain
  if (!title && !description) return 50 // Incertain
  if (titleOK && descOK) return 100
  if (!titleOK && !descOK) return 0
  return 50 // Un seul OK ou incertain
}

/**
 * Fonction pour calculer les CTR benchmarks par intent (top 10 par impressions)
 */
export async function getCTRBenchmarksByIntent(site?: string): Promise<Record<string, number>> {
  const siteFilter = site ? `AND domain = @site` : ''
  const query = `
    WITH top_pages_by_intent AS (
      SELECT 
        domain,
        intent,
        page_url,
        impressions,
        ctr,
        ROW_NUMBER() OVER (PARTITION BY domain, intent ORDER BY impressions DESC) as rank_impressions
      FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.serp_snapshots\`
      WHERE snapshot_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        AND intent IS NOT NULL
        ${siteFilter}
    ),
    top_10 AS (
      SELECT 
        intent,
        AVG(ctr) as avg_ctr,
        COUNT(*) as page_count
      FROM top_pages_by_intent
      WHERE rank_impressions <= 10
        AND ctr IS NOT NULL
      GROUP BY intent
    )
    SELECT 
      intent,
      avg_ctr as benchmark_ctr,
      page_count
    FROM top_10
    ORDER BY intent
  `

  const params: Record<string, any> = {}
  if (site) params.site = site

  try {
    const [rows] = await bigquery.query({ query, location, params })
    const benchmarks: Record<string, number> = {}
    for (const row of rows as any[]) {
      benchmarks[row.intent] = row.benchmark_ctr || 0
    }
    return benchmarks
  } catch (error: any) {
    console.error('❌ Error fetching CTR benchmarks:', error)
    return {} // Retourner objet vide si erreur (table peut ne pas exister encore)
  }
}

