/**
 * Script complet : Vérifie config + applique migration + lance ETL
 * 
 * Usage:
 *   npm run run:gsc-issues-test
 */

import 'dotenv/config'
import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'

console.log('🧪 Test complet GSC Issues')
console.log('='.repeat(60))

// 1. Vérifier .env
console.log('\n1️⃣  Vérification de la configuration...')

if (!existsSync('.env')) {
  console.error('❌ Fichier .env non trouvé')
  console.error('💡 Créer .env depuis .env.template: cp .env.template .env')
  process.exit(1)
}

const envContent = readFileSync('.env', 'utf-8')
const requiredVars = [
  'GCP_PROJECT_ID',
  'BQ_DATASET',
  'GCP_SA_KEY_JSON',
  'SITES_LIST',
]

const missing = requiredVars.filter(v => {
  const regex = new RegExp(`^${v}=`, 'm')
  return !regex.test(envContent) || envContent.match(regex)?.[0]?.includes('GCP_SA_KEY_JSON=') && envContent.match(/GCP_SA_KEY_JSON=\s*$/m)
})

if (missing.length > 0 || envContent.includes('GCP_SA_KEY_JSON=\n') || envContent.includes('GCP_SA_KEY_JSON=\r\n')) {
  console.error('❌ Variables manquantes ou vides dans .env:')
  missing.forEach(v => console.error(`   - ${v}`))
  if (envContent.includes('GCP_SA_KEY_JSON=\n') || envContent.includes('GCP_SA_KEY_JSON=\r\n')) {
    console.error('   - GCP_SA_KEY_JSON est vide')
  }
  console.error('\n💡 Éditer .env et remplir toutes les variables')
  process.exit(1)
}

console.log('✅ Configuration OK')

// 2. Vérifier que la migration est appliquée
console.log('\n2️⃣  Vérification migration BigQuery...')

try {
  const { BigQuery } = await import('@google-cloud/bigquery')
  const credentials = JSON.parse(process.env.GCP_SA_KEY_JSON!)
  const bigquery = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID,
    credentials,
  })

  const [tables] = await bigquery.dataset(process.env.BQ_DATASET!).getTables()
  const tableExists = tables.some(t => t.id === 'gsc_issues')

  if (!tableExists) {
    console.log('⚠️  Table gsc_issues non trouvée')
    console.log('📊 Application de la migration...')
    
    try {
      execSync('npm run apply-migration:gsc-issues', { stdio: 'inherit' })
      console.log('✅ Migration appliquée')
    } catch (error: any) {
      console.error('❌ Erreur lors de l\'application de la migration')
      console.error('💡 Appliquer manuellement: npm run apply-migration:gsc-issues')
      process.exit(1)
    }
  } else {
    console.log('✅ Table gsc_issues existe déjà')
  }
} catch (error: any) {
  console.error('❌ Erreur vérification migration:', error.message)
  process.exit(1)
}

// 3. Lancer l'ETL
console.log('\n3️⃣  Lancement de l\'ETL en mode test...')
console.log('   (TEST_MODE=true, MAX_URLS_PER_SITE=5)')
console.log('')

try {
  execSync('TEST_MODE=true MAX_URLS_PER_SITE=5 npm run etl:gsc-issues', { 
    stdio: 'inherit',
    env: { ...process.env, TEST_MODE: 'true', MAX_URLS_PER_SITE: '5' }
  })
  console.log('\n✅ ETL terminé avec succès!')
} catch (error: any) {
  console.error('\n❌ Erreur lors de l\'ETL')
  process.exit(1)
}

// 4. Vérifier les résultats
console.log('\n4️⃣  Vérification des résultats...')

try {
  const { BigQuery } = await import('@google-cloud/bigquery')
  const credentials = JSON.parse(process.env.GCP_SA_KEY_JSON!)
  const bigquery = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID,
    credentials,
  })

  const [rows] = await bigquery.query({
    query: `SELECT COUNT(*) as count FROM \`${process.env.GCP_PROJECT_ID}.${process.env.BQ_DATASET}.gsc_issues\` WHERE issue_date = CURRENT_DATE()`,
    location: 'europe-west1',
  })

  const count = rows[0]?.count || 0
  console.log(`📊 ${count} issue(s) détecté(s) aujourd'hui`)
  
  if (count > 0) {
    console.log('\n✅ Des issues ont été détectés!')
    console.log('\n💡 Voir les détails:')
    console.log('   - Dashboard: http://localhost:3000/gsc-issues (si dashboard lancé)')
    console.log('   - BigQuery: SELECT * FROM `moverz-dashboard.analytics_core.gsc_issues` WHERE issue_date = CURRENT_DATE()')
  } else {
    console.log('\n⚠️  Aucun issue détecté (normal si les pages sont bien indexées)')
  }
} catch (error: any) {
  console.error('⚠️  Erreur vérification résultats:', error.message)
}

console.log('\n✅ Test complet terminé!')

