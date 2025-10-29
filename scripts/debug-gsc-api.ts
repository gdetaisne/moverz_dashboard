import { google } from 'googleapis'
import { subDays, format } from 'date-fns'

const DOMAIN = 'devis-demenageur-nantes.fr'
const FETCH_DAYS = 90 // Récupérer 90 jours pour voir tous les clics

async function debugGSCAPI() {
  console.log('🔍 Debug API Search Console\n')
  
  // Authentification
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })
  
  const webmasters = google.searchconsole({ version: 'v1', auth })
  
  const endDate = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const startDate = format(subDays(new Date(), FETCH_DAYS), 'yyyy-MM-dd')
  
  console.log(`📅 Période : ${startDate} → ${endDate} (${FETCH_DAYS} jours)`)
  console.log(`🌐 Domaine : ${DOMAIN}\n`)
  
  try {
    const response = await webmasters.searchanalytics.query({
      siteUrl: `sc-domain:${DOMAIN}`,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date', 'page', 'query'],
        rowLimit: 25000,
        dataState: 'all', // Inclut les données préliminaires
      },
    })
    
    const rows = response.data.rows || []
    
    console.log(`📊 Total de lignes retournées : ${rows.length}\n`)
    
    // Statistiques globales
    let totalClicks = 0
    let totalImpressions = 0
    let rowsWithClicks = 0
    
    rows.forEach(row => {
      totalClicks += row.clicks || 0
      totalImpressions += row.impressions || 0
      if ((row.clicks || 0) > 0) rowsWithClicks++
    })
    
    console.log(`📈 Statistiques :`)
    console.log(`   Total clics      : ${totalClicks}`)
    console.log(`   Total impressions: ${totalImpressions}`)
    console.log(`   Lignes avec clics: ${rowsWithClicks}/${rows.length}\n`)
    
    // Afficher les 10 premières lignes AVEC des clics
    console.log(`🔎 Lignes avec des clics (top 10) :\n`)
    const rowsWithClicksData = rows.filter(r => (r.clicks || 0) > 0).slice(0, 10)
    
    if (rowsWithClicksData.length === 0) {
      console.log('   ❌ Aucune ligne avec des clics trouvée !')
    } else {
      rowsWithClicksData.forEach((row, i) => {
        console.log(`   ${i + 1}. Date: ${row.keys![0]}`)
        console.log(`      Page: ${row.keys![1]}`)
        console.log(`      Query: ${row.keys![2]}`)
        console.log(`      Clics: ${row.clicks}, Impressions: ${row.impressions}, CTR: ${(row.ctr! * 100).toFixed(2)}%`)
        console.log('')
      })
    }
    
    // Afficher les 10 premières lignes SANS clics (pour comparaison)
    console.log(`\n🔎 Lignes SANS clics (top 10 pour comparaison) :\n`)
    const rowsWithoutClicks = rows.filter(r => (r.clicks || 0) === 0).slice(0, 10)
    
    rowsWithoutClicks.forEach((row, i) => {
      console.log(`   ${i + 1}. Date: ${row.keys![0]}`)
      console.log(`      Page: ${row.keys![1]}`)
      console.log(`      Query: ${row.keys![2]}`)
      console.log(`      Clics: ${row.clicks || 0}, Impressions: ${row.impressions}, Position: ${row.position?.toFixed(1)}`)
      console.log('')
    })
    
  } catch (error: any) {
    console.error('❌ Erreur :', error.message)
  }
}

debugGSCAPI()

