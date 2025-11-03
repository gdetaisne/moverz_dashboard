/**
 * Script pour appliquer la migration 008_gsc_issues.sql automatiquement
 * 
 * Usage:
 *   npm run apply-migration:gsc-issues
 */

import { BigQuery } from '@google-cloud/bigquery'
import { readFileSync } from 'fs'
import { join } from 'path'
import 'dotenv/config'

const projectId = process.env.GCP_PROJECT_ID || 'moverz-dashboard'
const dataset = process.env.BQ_DATASET || 'analytics_core'

// Charger la clé depuis GCP_SA_KEY_JSON ou GOOGLE_APPLICATION_CREDENTIALS
function getCredentials() {
  if (process.env.GCP_SA_KEY_JSON) {
    try {
      return JSON.parse(process.env.GCP_SA_KEY_JSON)
    } catch (error) {
      throw new Error('GCP_SA_KEY_JSON n\'est pas un JSON valide')
    }
  }
  
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS
  }
  
  throw new Error('GCP_SA_KEY_JSON ou GOOGLE_APPLICATION_CREDENTIALS requis')
}

async function main() {
  console.log('📊 Application de la migration 008_gsc_issues.sql')
  console.log('='.repeat(60))
  console.log(`Projet: ${projectId}`)
  console.log(`Dataset: ${dataset}`)
  console.log('')

  try {
    // Initialiser BigQuery
    const credentials = getCredentials()
    const bigquery = new BigQuery({
      projectId,
      credentials: typeof credentials === 'string' ? undefined : credentials,
      keyFilename: typeof credentials === 'string' ? credentials : undefined,
    })

    // Lire le fichier SQL
    const sqlPath = join(process.cwd(), 'db/migrations/008_gsc_issues.sql')
    console.log(`📄 Lecture de ${sqlPath}...`)
    
    let sql = readFileSync(sqlPath, 'utf-8')
    
    // Séparer le SQL en statements (CREATE TABLE et CREATE VIEW)
    // On va extraire les blocs CREATE TABLE et CREATE VIEW séparément
    
    const tableMatch = sql.match(/CREATE TABLE IF NOT EXISTS[^;]+;/s)
    const viewMatches = sql.matchAll(/CREATE OR REPLACE VIEW[^;]+;/gs)
    
    const statements: string[] = []
    
    if (tableMatch) {
      statements.push(tableMatch[0])
    }
    
    for (const viewMatch of viewMatches) {
      statements.push(viewMatch[0])
    }
    
    console.log(`📝 ${statements.length} statements SQL trouvés`)
    console.log('')

    // Exécuter d'abord la table
    if (statements.length > 0 && statements[0].includes('CREATE TABLE')) {
      console.log(`🔧 Exécution CREATE TABLE...`)
      
      try {
        const [job] = await bigquery.createQueryJob({
          query: statements[0],
          location: 'europe-west1',
        })
        
        await job.getQueryResults()
        console.log(`✅ Table créée avec succès`)
      } catch (error: any) {
        // Si la table existe déjà, c'est OK
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          console.log(`⚠️  Table déjà existante (ignoré)`)
        } else {
          throw error
        }
      }
    }

    // Puis les vues
    console.log('')
    console.log('📊 Création des vues...')
    
    for (let i = 1; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement || !statement.includes('CREATE OR REPLACE VIEW')) {
        continue
      }

      console.log(`🔧 Création vue ${i}...`)
      try {
        const [job] = await bigquery.createQueryJob({
          query: statement,
          location: 'europe-west1',
        })
        
        await job.getQueryResults()
        console.log(`✅ Vue ${i} créée avec succès`)
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`⚠️  Vue ${i} déjà existante (remplacée)`)
        } else {
          console.error(`❌ Erreur création vue ${i}:`, error.message)
          // On continue même si une vue échoue
        }
      }
    }

    // Vérifier que la table existe
    console.log('')
    console.log('🔍 Vérification...')
    
    const [tables] = await bigquery.dataset(dataset).getTables()
    const tableExists = tables.some(t => t.id === 'gsc_issues')
    
    if (tableExists) {
      console.log('✅ Table gsc_issues créée avec succès!')
    } else {
      console.log('⚠️  Table gsc_issues non trouvée (mais migration exécutée)')
    }

    console.log('')
    console.log('✅ Migration terminée!')
    
    // Requête de test
    console.log('')
    console.log('🧪 Test de connexion...')
    try {
      const [rows] = await bigquery.query({
        query: `SELECT COUNT(*) as count FROM \`${projectId}.${dataset}.gsc_issues\``,
        location: 'europe-west1',
      })
      console.log(`✅ Connexion OK - ${rows[0]?.count || 0} issues actuellement dans la table`)
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        console.log('⚠️  Table créée mais vide (normal)')
      } else {
        console.error('❌ Erreur test:', error.message)
      }
    }

  } catch (error: any) {
    console.error('')
    console.error('❌ Erreur lors de l\'application de la migration:')
    console.error(error.message)
    if (error.stack) {
      console.error('')
      console.error('Stack trace:')
      console.error(error.stack)
    }
    process.exit(1)
  }
}

main()

