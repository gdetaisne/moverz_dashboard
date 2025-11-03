import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

// Charger le .env de la racine du projet manuellement
const projectRoot = path.resolve(process.cwd(), '..')
const envPath = path.join(projectRoot, '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=')
      if (key && values.length > 0) {
        const value = values.join('=').trim()
        // Ne pas écraser les variables déjà définies
        if (!process.env[key]) {
          // Gérer les valeurs entre guillemets
          const cleanValue = value.startsWith('"') && value.endsWith('"') 
            ? value.slice(1, -1) 
            : value.startsWith("'") && value.endsWith("'")
            ? value.slice(1, -1)
            : value
          process.env[key] = cleanValue
        }
      }
    }
  })
}

/**
 * POST /api/agents/gsc-issues-analyzer/run
 * Lance l'agent GSC Issues Analyzer manuellement depuis le dashboard
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🤖 Lancement manuel de l\'agent GSC Issues Analyzer...')

    // Déterminer le chemin vers le script (depuis la racine du projet)
    // Le dashboard est dans dashboard/, donc on remonte d'un niveau
    const projectRoot = path.resolve(process.cwd(), '..')
    const agentScript = path.join(projectRoot, 'scripts', 'run-gsc-issues-analyzer.ts')
    
    // Vérifier que le script existe
    if (!fs.existsSync(agentScript)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Script agent introuvable',
          error: `Script not found: ${agentScript}`,
        },
        { status: 404 }
      )
    }

    console.log('Project root:', projectRoot)
    console.log('Agent script:', agentScript)

    // Préparer les variables d'environnement à passer au script
    const envVars: Record<string, string | undefined> = {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
      GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || 'moverz-dashboard',
      BQ_DATASET: process.env.BQ_DATASET || 'analytics_core',
    }

    // Ajouter les variables optionnelles si elles existent
    if (process.env.GCP_SA_KEY_JSON) envVars.GCP_SA_KEY_JSON = process.env.GCP_SA_KEY_JSON
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) envVars.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (process.env.OPENAI_API_KEY) envVars.OPENAI_API_KEY = process.env.OPENAI_API_KEY
    if (process.env.SITES_LIST) envVars.SITES_LIST = process.env.SITES_LIST

    // Vérifier que la clé OpenAI est configurée (après chargement du .env)
    if (!envVars.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          message: 'OPENAI_API_KEY non configurée',
          error: 'La clé API OpenAI est requise pour exécuter l\'agent. Vérifiez qu\'elle est définie dans CapRover ou dans le fichier .env',
          hint: 'En production (CapRover), la variable doit être définie dans les variables d\'environnement de l\'application',
        },
        { status: 400 }
      )
    }

    console.log('OPENAI_API_KEY présente:', envVars.OPENAI_API_KEY ? '✅ Oui (longueur: ' + envVars.OPENAI_API_KEY.length + ')' : '❌ Non')

    // Lancer l'agent en arrière-plan
    const { stdout, stderr } = await execAsync(`npx tsx ${agentScript}`, {
      cwd: projectRoot,
      timeout: 120000, // 2 minutes max
      env: envVars as NodeJS.ProcessEnv,
    })

    console.log('✅ Agent terminé avec succès')
    console.log('STDOUT:', stdout)
    if (stderr) console.error('STDERR:', stderr)

    return NextResponse.json({
      success: true,
      message: 'Analyse lancée avec succès',
      timestamp: new Date().toISOString(),
      output: stdout,
    })
  } catch (error: any) {
    console.error('❌ Erreur lors du lancement de l\'agent:', error)

    // Extraire le message d'erreur utile
    let errorMessage = error.message || 'Erreur inconnue'
    if (error.stderr) {
      errorMessage = error.stderr.toString()
    } else if (error.stdout) {
      errorMessage = error.stdout.toString()
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Erreur lors du lancement de l\'agent',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

