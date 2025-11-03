/**
 * Script pour vérifier que la table errors_404_history existe dans BigQuery
 * Usage: npx tsx scripts/check-404-history-table.ts
 */

import { BigQuery } from '@google-cloud/bigquery'
import * as fs from 'fs'

const projectId = process.env.GCP_PROJECT_ID || 'moverz-dashboard'
const dataset = process.env.BQ_DATASET || 'analytics_core'
const tableName = 'errors_404_history'
const fullTableId = `${projectId}.${dataset}.${tableName}`

// Charger les credentials
let credentials: any
try {
  if (process.env.GCP_SA_KEY_JSON) {
    credentials = JSON.parse(process.env.GCP_SA_KEY_JSON)
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const keyFile = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
    credentials = JSON.parse(keyFile)
  } else {
    // Essayer le fichier par défaut
    const defaultKeyPath = '/Users/guillaumestehelin/Keys/moverz-analytics-service-account.json'
    if (fs.existsSync(defaultKeyPath)) {
      const keyFile = fs.readFileSync(defaultKeyPath, 'utf8')
      credentials = JSON.parse(keyFile)
    } else {
      throw new Error('Aucune clé de service trouvée. Définissez GCP_SA_KEY_JSON ou GOOGLE_APPLICATION_CREDENTIALS')
    }
  }
} catch (error) {
  console.error('❌ Erreur lors du chargement des credentials:', error)
  process.exit(1)
}

const bigquery = new BigQuery({
  projectId,
  credentials,
})

async function checkTable() {
  console.log(`🔍 Vérification de la table: ${fullTableId}\n`)

  try {
    // 1. Vérifier que le dataset existe
    console.log('1️⃣ Vérification du dataset...')
    const [datasetExists] = await bigquery.dataset(dataset).exists()
    if (!datasetExists) {
      console.error(`❌ Le dataset ${dataset} n'existe pas !`)
      console.log(`\n💡 Créer le dataset avec:`)
      console.log(`   bq mk ${projectId}:${dataset}`)
      return
    }
    console.log(`✅ Dataset ${dataset} existe\n`)

    // 2. Vérifier que la table existe
    console.log('2️⃣ Vérification de la table...')
    const [tableExists] = await bigquery.dataset(dataset).table(tableName).exists()
    if (!tableExists) {
      console.error(`❌ La table ${tableName} n'existe pas !`)
      console.log(`\n💡 Appliquer la migration avec:`)
      console.log(`   bq query --use_legacy_sql=false < db/migrations/004_errors_404_history.sql`)
      console.log(`\n   Ou via BigQuery Console:`)
      console.log(`   https://console.cloud.google.com/bigquery?project=${projectId}`)
      return
    }
    console.log(`✅ Table ${tableName} existe\n`)

    // 3. Obtenir les métadonnées de la table
    console.log('3️⃣ Informations sur la table...')
    const [metadata] = await bigquery.dataset(dataset).table(tableName).getMetadata()
    console.log(`   Description: ${metadata.description || '(aucune)'}`)
    console.log(`   Lignes: ${metadata.numRows?.toLocaleString() || '0'}`)
    console.log(`   Taille: ${metadata.numBytes ? (Number(metadata.numBytes) / 1024).toFixed(2) + ' KB' : '0 KB'}`)
    console.log(`   Partition: ${metadata.timePartitioning ? 'Oui' : 'Non'}`)
    if (metadata.timePartitioning) {
      console.log(`   Colonne de partition: ${metadata.timePartitioning.field || 'scan_date'}`)
    }
    console.log('')

    // 4. Compter les enregistrements
    console.log('4️⃣ Nombre d\'enregistrements...')
    const query = `SELECT COUNT(*) as total FROM \`${fullTableId}\``
    const [rows] = await bigquery.query({ query })
    const total = rows[0]?.total || 0
    console.log(`   Total: ${total.toLocaleString()} enregistrements`)

    if (total > 0) {
      // 5. Afficher les 5 derniers scans
      console.log('\n5️⃣ 5 derniers scans...')
      const recentQuery = `
        SELECT 
          id,
          scan_date,
          total_sites,
          total_pages_checked,
          total_errors_404,
          TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), scan_date, DAY) as days_ago
        FROM \`${fullTableId}\`
        ORDER BY scan_date DESC
        LIMIT 5
      `
      const [recentRows] = await bigquery.query({ query: recentQuery })
      recentRows.forEach((row: any, i: number) => {
        console.log(`   ${i + 1}. Scan ${row.id.substring(0, 8)}...`)
        console.log(`      Date: ${row.scan_date}`)
        console.log(`      Il y a: ${row.days_ago} jours`)
        console.log(`      Sites: ${row.total_sites}, Pages: ${row.total_pages_checked}, Erreurs: ${row.total_errors_404}`)
      })
    } else {
      console.log('   ⚠️  Aucun enregistrement dans la table')
      console.log('   💡 Lancez un scan depuis /404 pour créer le premier enregistrement')
    }

    console.log('\n✅ Vérification terminée !')
  } catch (error: any) {
    console.error('❌ Erreur:', error.message)
    if (error.code === 403) {
      console.error('\n💡 Problème de permissions. Vérifiez que le service account a les droits:')
      console.error('   - BigQuery Data Editor')
      console.error('   - BigQuery Job User')
    }
    process.exit(1)
  }
}

checkTable()

