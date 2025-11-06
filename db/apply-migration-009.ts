/**
 * Script pour appliquer la migration 009 (serp_metadata_snapshots)
 */

import 'dotenv/config'
import { BigQuery } from '@google-cloud/bigquery'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Charger .env.local depuis dashboard/
const envPath = path.resolve(__dirname, '..', 'dashboard', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()
      // Enlever les guillemets si présents
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  })
}

const config = {
  gcpProjectId: process.env.GCP_PROJECT_ID || 'moverz-dashboard',
  gcpSaKeyJson: process.env.GCP_SA_KEY_JSON || '',
}

if (!config.gcpSaKeyJson) {
  console.error('❌ GCP_SA_KEY_JSON is required')
  process.exit(1)
}

const credentials = JSON.parse(config.gcpSaKeyJson)
const bigquery = new BigQuery({
  projectId: config.gcpProjectId,
  credentials,
})

const BQ_LOCATION = process.env.BQ_LOCATION || 'europe-west1'

async function applyMigration() {
  const migrationFile = path.join(__dirname, 'migrations', '009_serp_metadata_snapshots.sql')
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`)
    process.exit(1)
  }
  
  const sql = fs.readFileSync(migrationFile, 'utf-8')
  
  console.log('📋 Applying migration 009: serp_metadata_snapshots...')
  console.log(`📁 Project: ${config.gcpProjectId}`)
  console.log(`📁 Dataset: analytics_core`)
  
  try {
    // BigQuery peut exécuter plusieurs statements séparés par des points-virgules
    // Mais on va les exécuter un par un pour mieux gérer les erreurs
    
    // Nettoyer le SQL : enlever les commentaires et diviser par les points-virgules
    const cleanedSql = sql
      .split('\n')
      .map(line => {
        // Enlever les commentaires de ligne
        const commentIndex = line.indexOf('--')
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex)
        }
        return line
      })
      .join('\n')
    
    // Diviser par les points-virgules (en respectant les chaînes)
    const statements: string[] = []
    let current = ''
    let inString = false
    let stringChar = ''
    
    for (let i = 0; i < cleanedSql.length; i++) {
      const char = cleanedSql[i]
      const nextChar = cleanedSql[i + 1]
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true
        stringChar = char
        current += char
      } else if (inString && char === stringChar && cleanedSql[i - 1] !== '\\') {
        inString = false
        current += char
      } else if (!inString && char === ';') {
        const trimmed = current.trim()
        if (trimmed.length > 10) {
          statements.push(trimmed)
        }
        current = ''
      } else {
        current += char
      }
    }
    
    // Ajouter le dernier statement s'il n'y a pas de point-virgule final
    const lastTrimmed = current.trim()
    if (lastTrimmed.length > 10) {
      statements.push(lastTrimmed)
    }
    
    console.log(`📝 Found ${statements.length} statements to execute`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      console.log(`\n🔧 Executing statement ${i + 1}/${statements.length}...`)
      console.log(`   ${statement.substring(0, 100).replace(/\n/g, ' ')}...`)
      
      try {
        const [job] = await bigquery.createQueryJob({
          query: statement,
          location: BQ_LOCATION,
        })
        
        await job.getQueryResults()
        console.log(`✅ Statement ${i + 1} executed successfully`)
      } catch (error: any) {
        // Si la table/vue existe déjà, c'est OK (CREATE TABLE IF NOT EXISTS)
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate') ||
            error.message?.includes('Already Exists')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists)`)
        } else {
          console.error(`❌ Statement ${i + 1} failed:`, error.message)
          console.error(`SQL preview: ${statement.substring(0, 300)}...`)
          throw error
        }
      }
    }
    
    console.log('\n✅ Migration 009 applied successfully!')
    console.log('\n📊 Created:')
    console.log('  - Table: serp_metadata_snapshots')
    console.log('  - View: serp_metadata_snapshots_complete')
    console.log('  - View: serp_metadata_templates_evolution')
    console.log('  - View: serp_metadata_snapshots_pending')
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message)
    process.exit(1)
  }
}

applyMigration().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

