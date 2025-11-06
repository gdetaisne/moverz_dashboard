/**
 * Analyse des clics GSC (Google Search Console) disponibles dans BigQuery
 * Date: 2025-11-06
 * Objectif: Analyser les clics depuis le 1er octobre pour construire le dashboard LeadGen (clics)
 */

import { BigQuery } from '@google-cloud/bigquery'

// Configuration BigQuery
const BQ_PROJECT_ID = process.env.GCP_PROJECT_ID || 'moverz-dashboard'
const BQ_DATASET = process.env.BQ_DATASET || 'analytics_core'
const BQ_LOCATION = process.env.BQ_LOCATION || 'europe-west1'

// Initialiser BigQuery
const bigquery = new BigQuery({
  projectId: BQ_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  credentials: process.env.GCP_SA_KEY_JSON ? JSON.parse(process.env.GCP_SA_KEY_JSON) : undefined,
})

interface AnalysisResult {
  tableExists: boolean
  totalClicks: number
  totalImpressions: number
  avgCTR: number
  avgPosition: number
  dateRange: { min: string | null; max: string | null }
  clicksBySite: Array<{ site: string; clicks: number; impressions: number; ctr: number; position: number; percentage: number }>
  dailyTrend: Array<{ date: string; clicks: number; impressions: number; ctr: number }>
  weeklyTrend: Array<{ week: string; clicks: number; impressions: number; ctr: number }>
  sitesStatus: Array<{ site: string; hasData: boolean; lastDate: string | null; daysWithData: number }>
  recommendations: string[]
}

async function checkTableExists(): Promise<boolean> {
  try {
    const query = `
      SELECT table_name
      FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.INFORMATION_SCHEMA.TABLES\`
      WHERE table_name = 'gsc_daily_aggregated'
    `
    const [rows] = await bigquery.query({ query, location: BQ_LOCATION })
    return rows.length > 0
  } catch (error) {
    return false
  }
}

async function analyzeClicks(): Promise<AnalysisResult> {
  const tableExists = await checkTableExists()
  
  if (!tableExists) {
    return {
      tableExists: false,
      totalClicks: 0,
      totalImpressions: 0,
      avgCTR: 0,
      avgPosition: 0,
      dateRange: { min: null, max: null },
      clicksBySite: [],
      dailyTrend: [],
      weeklyTrend: [],
      sitesStatus: [],
      recommendations: [
        '⚠️ La table gsc_daily_aggregated n\'existe pas encore dans BigQuery',
        '📋 Vérifier que l\'ETL gsc/fetch-simple.ts est configuré et exécuté',
        '🔧 Vérifier que les 11 sites sont bien trackés dans Google Search Console',
      ],
    }
  }

  // 1. Volume total et plage de dates depuis le 1er octobre
  const volumeQuery = `
    SELECT 
      SUM(clicks) as total_clicks,
      SUM(impressions) as total_impressions,
      SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as avg_ctr,
      AVG(position) as avg_position,
      MIN(date) as min_date,
      MAX(date) as max_date
    FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.gsc_daily_aggregated\`
    WHERE date >= '2025-10-01'
  `
  const [volumeRows] = await bigquery.query({ query: volumeQuery, location: BQ_LOCATION })
  const volume = volumeRows[0] as { 
    total_clicks: number
    total_impressions: number
    avg_ctr: number
    avg_position: number
    min_date: string
    max_date: string
  }

  // 2. Répartition par site
  const siteQuery = `
    SELECT 
      domain as site,
      SUM(clicks) as clicks,
      SUM(impressions) as impressions,
      SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr,
      AVG(position) as position
    FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.gsc_daily_aggregated\`
    WHERE date >= '2025-10-01'
    GROUP BY domain
    ORDER BY clicks DESC
  `
  const [siteRows] = await bigquery.query({ query: siteQuery, location: BQ_LOCATION })
  const totalClicks = Number(volume.total_clicks) || 0
  const clicksBySite = (siteRows as Array<{ site: string; clicks: number; impressions: number; ctr: number; position: number }>).map(row => ({
    site: row.site,
    clicks: Number(row.clicks),
    impressions: Number(row.impressions),
    ctr: Number(row.ctr) || 0,
    position: Number(row.position) || 0,
    percentage: totalClicks > 0 ? (Number(row.clicks) / totalClicks) * 100 : 0,
  }))

  // 3. Tendance quotidienne
  const trendQuery = `
    SELECT 
      date,
      SUM(clicks) as clicks,
      SUM(impressions) as impressions,
      SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr
    FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.gsc_daily_aggregated\`
    WHERE date >= '2025-10-01'
    GROUP BY date
    ORDER BY date DESC
  `
  const [trendRows] = await bigquery.query({ query: trendQuery, location: BQ_LOCATION })
  const dailyTrend = (trendRows as Array<{ date: string; clicks: number; impressions: number; ctr: number }>).map(row => ({
    date: String(row.date),
    clicks: Number(row.clicks),
    impressions: Number(row.impressions),
    ctr: Number(row.ctr) || 0,
  }))

  // 4. Tendance hebdomadaire (pour faible volume)
  const weeklyQuery = `
    SELECT 
      DATE_TRUNC(date, WEEK) as week,
      SUM(clicks) as clicks,
      SUM(impressions) as impressions,
      SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr
    FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.gsc_daily_aggregated\`
    WHERE date >= '2025-10-01'
    GROUP BY week
    ORDER BY week DESC
  `
  const [weeklyRows] = await bigquery.query({ query: weeklyQuery, location: BQ_LOCATION })
  const weeklyTrend = (weeklyRows as Array<{ week: string; clicks: number; impressions: number; ctr: number }>).map(row => ({
    week: String(row.week),
    clicks: Number(row.clicks),
    impressions: Number(row.impressions),
    ctr: Number(row.ctr) || 0,
  }))

  // 5. Statut par site (vérifier que tous les sites ont des données)
  const sitesStatusQuery = `
    SELECT 
      domain as site,
      MAX(date) as last_date,
      COUNT(DISTINCT date) as days_with_data
    FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.gsc_daily_aggregated\`
    WHERE date >= '2025-10-01'
    GROUP BY domain
    ORDER BY domain
  `
  const [sitesStatusRows] = await bigquery.query({ query: sitesStatusQuery, location: BQ_LOCATION })
  const sitesStatus = (sitesStatusRows as Array<{ site: string; last_date: string; days_with_data: number }>).map(row => ({
    site: row.site,
    hasData: Number(row.days_with_data) > 0,
    lastDate: row.last_date ? String(row.last_date) : null,
    daysWithData: Number(row.days_with_data),
  }))

  // Sites attendus (11 sites)
  const expectedSites = [
    'devis-demenageur-marseille.fr',
    'devis-demenageur-strasbourg.fr',
    'devis-demenageur-lille.fr',
    'devis-demenageur-rennes.fr',
    'devis-demenageur-rouen.fr',
    'devis-demenageur-nice.fr',
    'devis-demenageur-nantes.fr',
    'devis-demenageur-toulousain.fr',
    'devis-demenageur-lyon.fr',
    'bordeaux-demenageur.fr',
    'devis-demenageur-montpellier.fr',
  ]

  // Générer recommandations
  const recommendations: string[] = []
  
  if (totalClicks === 0) {
    recommendations.push('⚠️ Aucun clic trouvé depuis le 1er octobre')
    recommendations.push('📋 Vérifier que les sites sont bien indexés dans Google Search Console')
    recommendations.push('🔧 Vérifier que l\'ETL gsc/fetch-simple.ts s\'exécute correctement')
  } else if (totalClicks < 100) {
    recommendations.push(`📊 Volume faible (${totalClicks} clics) : regrouper les données par semaine pour analyses`)
    recommendations.push('📈 Considérer des périodes plus longues (30+ jours) pour avoir des statistiques significatives')
  }

  const sitesWithData = sitesStatus.filter(s => s.hasData).length
  if (sitesWithData < 11) {
    recommendations.push(`⚠️ Seulement ${sitesWithData}/11 sites ont des données`)
    recommendations.push('📋 Vérifier que tous les sites sont bien trackés dans GSC')
    recommendations.push('🔧 Vérifier les permissions GSC pour les sites manquants')
  }

  const avgCTR = Number(volume.avg_ctr) || 0
  if (avgCTR < 0.01) {
    recommendations.push(`⚠️ CTR moyen faible (${(avgCTR * 100).toFixed(2)}%)`)
    recommendations.push('📈 Analyser les positions moyennes et optimiser les titres/meta descriptions')
  }

  // Vérifier les sites manquants
  const sitesWithDataNames = sitesStatus.filter(s => s.hasData).map(s => s.site)
  const missingSites = expectedSites.filter(site => !sitesWithDataNames.includes(site))
  if (missingSites.length > 0) {
    recommendations.push(`⚠️ Sites sans données: ${missingSites.join(', ')}`)
  }

  return {
    tableExists: true,
    totalClicks: totalClicks,
    totalImpressions: Number(volume.total_impressions) || 0,
    avgCTR: avgCTR,
    avgPosition: Number(volume.avg_position) || 0,
    dateRange: {
      min: volume.min_date ? String(volume.min_date) : null,
      max: volume.max_date ? String(volume.max_date) : null,
    },
    clicksBySite,
    dailyTrend,
    weeklyTrend,
    sitesStatus,
    recommendations,
  }
}

async function main() {
  console.log('🔍 ANALYSE DES CLICS GSC - Dashboard LeadGen (Clics)\n')
  console.log('=' .repeat(70))
  console.log('Date: 2025-11-06')
  console.log('Période analysée: Depuis le 1er octobre 2025')
  console.log('=' .repeat(70) + '\n')

  try {
    const analysis = await analyzeClicks()

    // 1. Existence de la table
    console.log('📊 1. EXISTENCE DE LA TABLE')
    console.log('-'.repeat(70))
    console.log(`Table exists: ${analysis.tableExists ? '✅ OUI' : '❌ NON'}\n`)

    if (!analysis.tableExists) {
      console.log('⚠️  RECOMMANDATIONS:')
      analysis.recommendations.forEach(rec => console.log(`   ${rec}`))
      return
    }

    // 2. Volume total
    console.log('📊 2. VOLUME TOTAL')
    console.log('-'.repeat(70))
    console.log(`Total clics depuis le 1er octobre: ${analysis.totalClicks.toLocaleString('fr-FR')}`)
    console.log(`Total impressions: ${analysis.totalImpressions.toLocaleString('fr-FR')}`)
    console.log(`CTR moyen: ${(analysis.avgCTR * 100).toFixed(2)}%`)
    console.log(`Position moyenne: ${analysis.avgPosition.toFixed(1)}`)
    console.log(`Plage de dates: ${analysis.dateRange.min || 'N/A'} → ${analysis.dateRange.max || 'N/A'}\n`)

    // 3. Répartition par site
    console.log('📊 3. RÉPARTITION PAR SITE')
    console.log('-'.repeat(70))
    if (analysis.clicksBySite.length === 0) {
      console.log('   Aucun clic trouvé\n')
    } else {
      console.log('   Site'.padEnd(40) + 'Clics'.padStart(10) + 'Impr.'.padStart(12) + 'CTR'.padStart(8) + 'Pos.'.padStart(8) + '%'.padStart(8))
      console.log('   ' + '-'.repeat(76))
      analysis.clicksBySite.forEach(({ site, clicks, impressions, ctr, position, percentage }) => {
        const siteName = site.length > 38 ? site.substring(0, 35) + '...' : site
        console.log(`   ${siteName.padEnd(40)}${clicks.toLocaleString('fr-FR').padStart(10)}${impressions.toLocaleString('fr-FR').padStart(12)}${(ctr * 100).toFixed(2).padStart(6)}%${position.toFixed(1).padStart(7)}${percentage.toFixed(1).padStart(6)}%`)
      })
      console.log()
    }

    // 4. Statut par site (11 sites attendus)
    console.log('📊 4. STATUT PAR SITE (11 sites attendus)')
    console.log('-'.repeat(70))
    const sitesWithData = analysis.sitesStatus.filter(s => s.hasData).length
    console.log(`   Sites avec données: ${sitesWithData}/11`)
    console.log()
    
    analysis.sitesStatus.forEach(({ site, hasData, lastDate, daysWithData }) => {
      const status = hasData ? '✅' : '❌'
      const lastDateStr = lastDate || 'N/A'
      console.log(`   ${status} ${site.padEnd(45)} ${daysWithData.toString().padStart(3)} jours (dernier: ${lastDateStr})`)
    })
    console.log()

    // 5. Tendance quotidienne (7 derniers jours)
    console.log('📊 5. TENDANCE QUOTIDIENNE (7 derniers jours)')
    console.log('-'.repeat(70))
    const recentTrend = analysis.dailyTrend.slice(0, 7)
    if (recentTrend.length === 0) {
      console.log('   Aucune donnée récente\n')
    } else {
      console.log('   Date'.padEnd(15) + 'Clics'.padStart(10) + 'Impr.'.padStart(12) + 'CTR'.padStart(8))
      console.log('   ' + '-'.repeat(45))
      recentTrend.forEach(({ date, clicks, impressions, ctr }) => {
        const bar = '█'.repeat(Math.min(Math.floor(clicks / 5), 30))
        console.log(`   ${date.padEnd(15)}${clicks.toLocaleString('fr-FR').padStart(10)}${impressions.toLocaleString('fr-FR').padStart(12)}${(ctr * 100).toFixed(2).padStart(6)}% ${bar}`)
      })
      console.log()
    }

    // 6. Tendance hebdomadaire (pour faible volume)
    console.log('📊 6. TENDANCE HEBDOMADAIRE (recommandé pour faible volume)')
    console.log('-'.repeat(70))
    if (analysis.weeklyTrend.length === 0) {
      console.log('   Aucune donnée hebdomadaire\n')
    } else {
      console.log('   Semaine'.padEnd(15) + 'Clics'.padStart(10) + 'Impr.'.padStart(12) + 'CTR'.padStart(8))
      console.log('   ' + '-'.repeat(45))
      analysis.weeklyTrend.forEach(({ week, clicks, impressions, ctr }) => {
        const bar = '█'.repeat(Math.min(Math.floor(clicks / 10), 30))
        console.log(`   ${week.padEnd(15)}${clicks.toLocaleString('fr-FR').padStart(10)}${impressions.toLocaleString('fr-FR').padStart(12)}${(ctr * 100).toFixed(2).padStart(6)}% ${bar}`)
      })
      console.log()
    }

    // 7. Recommandations
    if (analysis.recommendations.length > 0) {
      console.log('💡 RECOMMANDATIONS')
      console.log('-'.repeat(70))
      analysis.recommendations.forEach(rec => console.log(`   ${rec}`))
      console.log()
    }

    // 8. Structure dashboard recommandée
    console.log('🎯 STRUCTURE DASHBOARD RECOMMANDÉE')
    console.log('-'.repeat(70))
    if (analysis.totalClicks < 100) {
      console.log('   📊 Volume faible (< 100 clics) → Regrouper par semaine')
      console.log('   📈 Périodes recommandées: 30 jours minimum')
      console.log('   🔄 Agrégations: Par semaine plutôt que par jour')
      console.log('   ⚠️  Avertissement "Volume faible" à afficher dans le dashboard')
    } else {
      console.log('   📊 Volume acceptable → Analyses quotidiennes possibles')
      console.log('   📈 Périodes recommandées: 7, 30, 90 jours')
      console.log('   🔄 Agrégations: Par jour ou par semaine selon besoin')
    }
    console.log()

  } catch (error: any) {
    console.error('❌ Erreur lors de l\'analyse:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()

