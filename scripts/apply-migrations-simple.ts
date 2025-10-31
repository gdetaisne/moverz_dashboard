import { BigQuery } from '@google-cloud/bigquery'
import fs from 'fs'
import path from 'path'

// Simuler le chargement du .env comme Next.js le fait
function loadEnvFromFile() {
  const envPath = path.join(process.cwd(), 'dashboard', '.env')
  if (!fs.existsSync(envPath)) {
    throw new Error(`❌ Fichier .env non trouvé: ${envPath}`)
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const env: Record<string, string> = {}
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      env[key] = value
    }
  })
  
  return env
}

const env = loadEnvFromFile()

const bigquery = new BigQuery({
  projectId: env.GCP_PROJECT_ID || 'moverz-dashboard',
  keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS,
})

async function runMigration(sql: string, name: string) {
  console.log(`📄 ${name}`)
  
  try {
    // Exécuter la requête complète (supporte plusieurs statements)
    const options = {
      query: sql,
      location: env.BQ_LOCATION || 'europe-west1',
    }
    
    await bigquery.query(options)
    console.log('   ✅ Succès\n')
  } catch (error: any) {
    // Skip si "already exists"
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      console.log('   ⚠️  Existe déjà (skip)\n')
      return
    }
    
    console.error(`   ❌ Erreur: ${error.message}\n`)
    throw error
  }
}

async function main() {
  console.log(`🚀 Application des migrations BigQuery`)
  console.log(`   Projet: ${env.GCP_PROJECT_ID}\n`)
  
  // Migration 004 - errors_404_history
  const migration004 = fs.readFileSync(path.join(process.cwd(), 'db', 'migrations', '004_errors_404_history.sql'), 'utf-8')
  await runMigration(migration004, 'Migration 004: errors_404_history')
  
  // Migration 006
  const migration006 = fs.readFileSync(path.join(process.cwd(), 'db', 'migrations', '006_errors_404_urls.sql'), 'utf-8')
  await runMigration(migration006, 'Migration 006: errors_404_urls')
  
  // Migration 007
  const migration007 = fs.readFileSync(path.join(process.cwd(), 'db', 'migrations', '007_broken_links.sql'), 'utf-8')
  await runMigration(migration007, 'Migration 007: broken_links')
  
  console.log('✅ Migrations appliquées avec succès!')
}

main().catch(console.error)

