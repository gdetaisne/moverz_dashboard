import { google } from 'googleapis'

const DOMAIN = 'devis-demenageur-nantes.fr'
const START_DATE = '2025-10-10'
const END_DATE = '2025-10-28'

async function debugExact() {
  console.log('🔍 Debug API Search Console - Période EXACTE de l\'interface\n')
  
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })
  
  const webmasters = google.searchconsole({ version: 'v1', auth })
  
  console.log(`📅 Période : ${START_DATE} → ${END_DATE}`)
  console.log(`🌐 Domaine : ${DOMAIN}\n`)
  
  // Test 1: Sans dimensions (agrégat total)
  console.log('═══════════════════════════════════════')
  console.log('TEST 1: Sans dimensions (TOTAL AGRÉGÉ)')
  console.log('═══════════════════════════════════════\n')
  
  try {
    const response1 = await webmasters.searchanalytics.query({
      siteUrl: `sc-domain:${DOMAIN}`,
      requestBody: {
        startDate: START_DATE,
        endDate: END_DATE,
        dataState: 'all',
      },
    })
    
    console.log('📊 Réponse de l\'API (agrégat) :')
    console.log(JSON.stringify(response1.data, null, 2))
  } catch (error: any) {
    console.error('❌ Erreur :', error.message)
  }
  
  // Test 2: Avec dimension date uniquement
  console.log('\n═══════════════════════════════════════')
  console.log('TEST 2: Avec dimension DATE uniquement')
  console.log('═══════════════════════════════════════\n')
  
  try {
    const response2 = await webmasters.searchanalytics.query({
      siteUrl: `sc-domain:${DOMAIN}`,
      requestBody: {
        startDate: START_DATE,
        endDate: END_DATE,
        dimensions: ['date'],
        dataState: 'all',
      },
    })
    
    const rows = response2.data.rows || []
    console.log(`📊 ${rows.length} lignes retournées\n`)
    
    let totalClicks = 0
    let totalImpressions = 0
    
    console.log('Dates avec des clics :')
    rows.forEach(row => {
      totalClicks += row.clicks || 0
      totalImpressions += row.impressions || 0
      
      if ((row.clicks || 0) > 0) {
        console.log(`  ${row.keys![0]}: ${row.clicks} clics, ${row.impressions} impressions`)
      }
    })
    
    console.log(`\n📈 TOTAL : ${totalClicks} clics, ${totalImpressions} impressions`)
  } catch (error: any) {
    console.error('❌ Erreur :', error.message)
  }
  
  // Test 3: Avec toutes les dimensions (comme notre ETL)
  console.log('\n═══════════════════════════════════════')
  console.log('TEST 3: Avec dimensions [date, page, query]')
  console.log('═══════════════════════════════════════\n')
  
  try {
    const response3 = await webmasters.searchanalytics.query({
      siteUrl: `sc-domain:${DOMAIN}`,
      requestBody: {
        startDate: START_DATE,
        endDate: END_DATE,
        dimensions: ['date', 'page', 'query'],
        rowLimit: 25000,
        dataState: 'all',
      },
    })
    
    const rows = response3.data.rows || []
    console.log(`📊 ${rows.length} lignes retournées\n`)
    
    let totalClicks = 0
    let totalImpressions = 0
    let rowsWithClicks = 0
    
    rows.forEach(row => {
      totalClicks += row.clicks || 0
      totalImpressions += row.impressions || 0
      if ((row.clicks || 0) > 0) rowsWithClicks++
    })
    
    console.log(`📈 TOTAL : ${totalClicks} clics, ${totalImpressions} impressions`)
    console.log(`📈 Lignes avec clics : ${rowsWithClicks}/${rows.length}\n`)
    
    if (rowsWithClicks > 0) {
      console.log('🔎 Premières lignes avec des clics :')
      rows.filter(r => (r.clicks || 0) > 0).slice(0, 5).forEach((row, i) => {
        console.log(`\n  ${i + 1}. Date: ${row.keys![0]}`)
        console.log(`     Page: ${row.keys![1]}`)
        console.log(`     Query: ${row.keys![2]}`)
        console.log(`     Clics: ${row.clicks}, Impressions: ${row.impressions}`)
      })
    }
  } catch (error: any) {
    console.error('❌ Erreur :', error.message)
  }
}

debugExact()

