/**
 * Analyse des données Leads disponibles dans BigQuery
 * Date: 2025-11-06
 * Objectif: Analyser la situation actuelle pour construire le dashboard LeadGen
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
  totalLeads: number
  dateRange: { min: string | null; max: string | null }
  leadsBySite: Array<{ site: string; count: number; percentage: number }>
  leadsByStatus: Array<{ status: string; count: number; percentage: number }>
  leadsBySource: Array<{ source: string; count: number; percentage: number }>
  metadataQuality: {
    hasUtmSource: number
    hasUtmMedium: number
    hasUtmCampaign: number
    hasSource: number
    hasMedium: number
    missingMetadata: number
  }
  dailyTrend: Array<{ date: string; count: number }>
  conversionRate: {
    total: number
    pending: number
    contacted: number
    converted: number
    lost: number
    conversionRate: number
  }
  recommendations: string[]
}

async function checkTableExists(): Promise<boolean> {
  try {
    const query = `
      SELECT table_name
      FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.INFORMATION_SCHEMA.TABLES\`
      WHERE table_name = 'leads'
    `
    const [rows] = await bigquery.query({ query, location: BQ_LOCATION })
    return rows.length > 0
  } catch (error) {
    return false
  }
}

async function analyzeLeads(): Promise<AnalysisResult> {
  const tableExists = await checkTableExists()
  
  if (!tableExists) {
    return {
      tableExists: false,
      totalLeads: 0,
      dateRange: { min: null, max: null },
      leadsBySite: [],
      leadsByStatus: [],
      leadsBySource: [],
      metadataQuality: {
        hasUtmSource: 0,
        hasUtmMedium: 0,
        hasUtmCampaign: 0,
        hasSource: 0,
        hasMedium: 0,
        missingMetadata: 0,
      },
      dailyTrend: [],
      conversionRate: {
        total: 0,
        pending: 0,
        contacted: 0,
        converted: 0,
        lost: 0,
        conversionRate: 0,
      },
      recommendations: [
        '⚠️ La table leads n\'existe pas encore dans BigQuery',
        '📋 Vérifier que l\'ETL leads/sync.ts est configuré et exécuté',
        '🔧 Vérifier que PostgreSQL contient des leads à synchroniser',
      ],
    }
  }

  // 1. Volume total et plage de dates
  const volumeQuery = `
    SELECT 
      COUNT(*) as total,
      MIN(DATE(created_at)) as min_date,
      MAX(DATE(created_at)) as max_date
    FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.leads\`
    WHERE DATE(created_at) >= '2025-10-01'
  `
  const [volumeRows] = await bigquery.query({ query: volumeQuery, location: BQ_LOCATION })
  const volume = volumeRows[0] as { total: number; min_date: string; max_date: string }

  // 2. Répartition par site
  const siteQuery = `
    SELECT 
      site,
      COUNT(*) as count
    FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.leads\`
    WHERE DATE(created_at) >= '2025-10-01'
    GROUP BY site
    ORDER BY count DESC
  `
  const [siteRows] = await bigquery.query({ query: siteQuery, location: BQ_LOCATION })
  const leadsBySite = (siteRows as Array<{ site: string; count: number }>).map(row => ({
    site: row.site,
    count: Number(row.count),
    percentage: volume.total > 0 ? (Number(row.count) / volume.total) * 100 : 0,
  }))

  // 3. Répartition par status
  const statusQuery = `
    SELECT 
      COALESCE(status, 'unknown') as status,
      COUNT(*) as count
    FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.leads\`
    WHERE DATE(created_at) >= '2025-10-01'
    GROUP BY status
    ORDER BY count DESC
  `
  const [statusRows] = await bigquery.query({ query: statusQuery, location: BQ_LOCATION })
  const leadsByStatus = (statusRows as Array<{ status: string; count: number }>).map(row => ({
    status: row.status,
    count: Number(row.count),
    percentage: volume.total > 0 ? (Number(row.count) / volume.total) * 100 : 0,
  }))

  // 4. Répartition par source
  const sourceQuery = `
    SELECT 
      COALESCE(source, 'unknown') as source,
      COUNT(*) as count
    FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.leads\`
    WHERE DATE(created_at) >= '2025-10-01'
    GROUP BY source
    ORDER BY count DESC
    LIMIT 20
  `
  const [sourceRows] = await bigquery.query({ query: sourceQuery, location: BQ_LOCATION })
  const leadsBySource = (sourceRows as Array<{ source: string; count: number }>).map(row => ({
    source: row.source,
    count: Number(row.count),
    percentage: volume.total > 0 ? (Number(row.count) / volume.total) * 100 : 0,
  }))

  // 5. Qualité des métadonnées
  const metadataQuery = `
    SELECT 
      COUNT(*) as total,
      COUNT(utm_source) as has_utm_source,
      COUNT(utm_medium) as has_utm_medium,
      COUNT(utm_campaign) as has_utm_campaign,
      COUNT(source) as has_source,
      COUNT(medium) as has_medium,
      COUNTIF(utm_source IS NULL AND utm_medium IS NULL AND utm_campaign IS NULL AND source IS NULL) as missing_all
    FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.leads\`
    WHERE DATE(created_at) >= '2025-10-01'
  `
  const [metadataRows] = await bigquery.query({ query: metadataQuery, location: BQ_LOCATION })
  const metadata = metadataRows[0] as {
    total: number
    has_utm_source: number
    has_utm_medium: number
    has_utm_campaign: number
    has_source: number
    has_medium: number
    missing_all: number
  }

  // 6. Tendance quotidienne
  const trendQuery = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count
    FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.leads\`
    WHERE DATE(created_at) >= '2025-10-01'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `
  const [trendRows] = await bigquery.query({ query: trendQuery, location: BQ_LOCATION })
  const dailyTrend = (trendRows as Array<{ date: string; count: number }>).map(row => ({
    date: String(row.date),
    count: Number(row.count),
  }))

  // 7. Taux de conversion
  const conversionQuery = `
    SELECT 
      COUNT(*) as total,
      COUNTIF(status = 'pending') as pending,
      COUNTIF(status = 'contacted') as contacted,
      COUNTIF(status = 'converted') as converted,
      COUNTIF(status = 'lost') as lost
    FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.leads\`
    WHERE DATE(created_at) >= '2025-10-01'
  `
  const [conversionRows] = await bigquery.query({ query: conversionQuery, location: BQ_LOCATION })
  const conversion = conversionRows[0] as {
    total: number
    pending: number
    contacted: number
    converted: number
    lost: number
  }
  const conversionRate = conversion.total > 0 
    ? (conversion.converted / conversion.total) * 100 
    : 0

  // Générer recommandations
  const recommendations: string[] = []
  
  if (volume.total === 0) {
    recommendations.push('⚠️ Aucun lead trouvé depuis le 1er octobre')
    recommendations.push('📋 Vérifier que les formulaires génèrent bien des leads dans PostgreSQL')
    recommendations.push('🔧 Vérifier que l\'ETL leads/sync.ts s\'exécute correctement')
  } else if (volume.total < 50) {
    recommendations.push('📊 Volume faible (< 50 leads) : regrouper les données par semaine/mois pour analyses')
    recommendations.push('📈 Considérer des périodes plus longues (30+ jours) pour avoir des statistiques significatives')
  }

  const metadataCompleteness = (
    (metadata.has_utm_source + metadata.has_source) / metadata.total
  ) * 100
  
  if (metadataCompleteness < 80) {
    recommendations.push(`⚠️ Qualité métadonnées faible (${metadataCompleteness.toFixed(1)}%)`)
    recommendations.push('🔧 Vérifier le tracking UTM sur les formulaires')
    recommendations.push('📋 S\'assurer que source/medium sont bien capturés')
  }

  if (metadata.missing_all > 0) {
    recommendations.push(`⚠️ ${metadata.missing_all} leads sans aucune métadonnée (${(metadata.missing_all / metadata.total * 100).toFixed(1)}%)`)
  }

  if (leadsBySite.length < 11) {
    recommendations.push(`⚠️ Seulement ${leadsBySite.length}/11 sites ont généré des leads`)
    recommendations.push('📋 Vérifier que tous les sites sont bien trackés')
  }

  if (conversionRate < 5) {
    recommendations.push(`⚠️ Taux de conversion faible (${conversionRate.toFixed(1)}%)`)
    recommendations.push('📈 Analyser les raisons des pertes (status "lost")')
  }

  return {
    tableExists: true,
    totalLeads: Number(volume.total),
    dateRange: {
      min: volume.min_date ? String(volume.min_date) : null,
      max: volume.max_date ? String(volume.max_date) : null,
    },
    leadsBySite,
    leadsByStatus,
    leadsBySource,
    metadataQuality: {
      hasUtmSource: Number(metadata.has_utm_source),
      hasUtmMedium: Number(metadata.has_utm_medium),
      hasUtmCampaign: Number(metadata.has_utm_campaign),
      hasSource: Number(metadata.has_source),
      hasMedium: Number(metadata.has_medium),
      missingMetadata: Number(metadata.missing_all),
    },
    dailyTrend,
    conversionRate: {
      total: Number(conversion.total),
      pending: Number(conversion.pending),
      contacted: Number(conversion.contacted),
      converted: Number(conversion.converted),
      lost: Number(conversion.lost),
      conversionRate,
    },
    recommendations,
  }
}

async function main() {
  console.log('🔍 ANALYSE DES DONNÉES LEADS - Dashboard LeadGen\n')
  console.log('=' .repeat(60))
  console.log('Date: 2025-11-06')
  console.log('Période analysée: Depuis le 1er octobre 2025')
  console.log('=' .repeat(60) + '\n')

  try {
    const analysis = await analyzeLeads()

    // 1. Existence de la table
    console.log('📊 1. EXISTENCE DE LA TABLE')
    console.log('-'.repeat(60))
    console.log(`Table exists: ${analysis.tableExists ? '✅ OUI' : '❌ NON'}\n`)

    if (!analysis.tableExists) {
      console.log('⚠️  RECOMMANDATIONS:')
      analysis.recommendations.forEach(rec => console.log(`   ${rec}`))
      return
    }

    // 2. Volume total
    console.log('📊 2. VOLUME TOTAL')
    console.log('-'.repeat(60))
    console.log(`Total leads depuis le 1er octobre: ${analysis.totalLeads}`)
    console.log(`Plage de dates: ${analysis.dateRange.min || 'N/A'} → ${analysis.dateRange.max || 'N/A'}\n`)

    // 3. Répartition par site
    console.log('📊 3. RÉPARTITION PAR SITE')
    console.log('-'.repeat(60))
    if (analysis.leadsBySite.length === 0) {
      console.log('   Aucun lead trouvé\n')
    } else {
      analysis.leadsBySite.forEach(({ site, count, percentage }) => {
        console.log(`   ${site.padEnd(30)} ${count.toString().padStart(5)} (${percentage.toFixed(1)}%)`)
      })
      console.log()
    }

    // 4. Répartition par status
    console.log('📊 4. RÉPARTITION PAR STATUS')
    console.log('-'.repeat(60))
    analysis.leadsByStatus.forEach(({ status, count, percentage }) => {
      console.log(`   ${status.padEnd(15)} ${count.toString().padStart(5)} (${percentage.toFixed(1)}%)`)
    })
    console.log()

    // 5. Répartition par source
    console.log('📊 5. RÉPARTITION PAR SOURCE (Top 20)')
    console.log('-'.repeat(60))
    if (analysis.leadsBySource.length === 0) {
      console.log('   Aucune source trouvée\n')
    } else {
      analysis.leadsBySource.forEach(({ source, count, percentage }) => {
        console.log(`   ${source.padEnd(30)} ${count.toString().padStart(5)} (${percentage.toFixed(1)}%)`)
      })
      console.log()
    }

    // 6. Qualité des métadonnées
    console.log('📊 6. QUALITÉ DES MÉTADONNÉES')
    console.log('-'.repeat(60))
    const total = analysis.totalLeads
    console.log(`   Total leads: ${total}`)
    console.log(`   Avec utm_source: ${analysis.metadataQuality.hasUtmSource} (${(analysis.metadataQuality.hasUtmSource / total * 100).toFixed(1)}%)`)
    console.log(`   Avec utm_medium: ${analysis.metadataQuality.hasUtmMedium} (${(analysis.metadataQuality.hasUtmMedium / total * 100).toFixed(1)}%)`)
    console.log(`   Avec utm_campaign: ${analysis.metadataQuality.hasUtmCampaign} (${(analysis.metadataQuality.hasUtmCampaign / total * 100).toFixed(1)}%)`)
    console.log(`   Avec source: ${analysis.metadataQuality.hasSource} (${(analysis.metadataQuality.hasSource / total * 100).toFixed(1)}%)`)
    console.log(`   Avec medium: ${analysis.metadataQuality.hasMedium} (${(analysis.metadataQuality.hasMedium / total * 100).toFixed(1)}%)`)
    console.log(`   Sans métadonnées: ${analysis.metadataQuality.missingMetadata} (${(analysis.metadataQuality.missingMetadata / total * 100).toFixed(1)}%)`)
    console.log()

    // 7. Tendance quotidienne
    console.log('📊 7. TENDANCE QUOTIDIENNE (7 derniers jours)')
    console.log('-'.repeat(60))
    const recentTrend = analysis.dailyTrend.slice(0, 7)
    if (recentTrend.length === 0) {
      console.log('   Aucune donnée récente\n')
    } else {
      recentTrend.forEach(({ date, count }) => {
        const bar = '█'.repeat(Math.min(Math.floor(count / 2), 20))
        console.log(`   ${date} ${count.toString().padStart(4)} ${bar}`)
      })
      console.log()
    }

    // 8. Taux de conversion
    console.log('📊 8. TAUX DE CONVERSION')
    console.log('-'.repeat(60))
    const conv = analysis.conversionRate
    console.log(`   Total: ${conv.total}`)
    console.log(`   Pending: ${conv.pending} (${(conv.pending / conv.total * 100).toFixed(1)}%)`)
    console.log(`   Contacted: ${conv.contacted} (${(conv.contacted / conv.total * 100).toFixed(1)}%)`)
    console.log(`   Converted: ${conv.converted} (${(conv.converted / conv.total * 100).toFixed(1)}%)`)
    console.log(`   Lost: ${conv.lost} (${(conv.lost / conv.total * 100).toFixed(1)}%)`)
    console.log(`   📈 Taux de conversion: ${conv.conversionRate.toFixed(2)}%`)
    console.log()

    // 9. Recommandations
    if (analysis.recommendations.length > 0) {
      console.log('💡 RECOMMANDATIONS')
      console.log('-'.repeat(60))
      analysis.recommendations.forEach(rec => console.log(`   ${rec}`))
      console.log()
    }

    // 10. Structure dashboard recommandée
    console.log('🎯 STRUCTURE DASHBOARD RECOMMANDÉE')
    console.log('-'.repeat(60))
    if (analysis.totalLeads < 50) {
      console.log('   📊 Volume faible → Regrouper par semaine/mois')
      console.log('   📈 Périodes recommandées: 30 jours minimum')
      console.log('   🔄 Agrégations: Par semaine plutôt que par jour')
    } else {
      console.log('   📊 Volume acceptable → Analyses quotidiennes possibles')
      console.log('   📈 Périodes recommandées: 7, 30, 90 jours')
    }
    console.log()

  } catch (error: any) {
    console.error('❌ Erreur lors de l\'analyse:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()

