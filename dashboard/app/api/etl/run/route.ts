import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { logger } from '@/lib/logger'
import type { ApiSuccessResponse, ApiErrorResponse } from '@/lib/api-helpers'

const execAsync = promisify(exec)

/**
 * POST /api/etl/run
 * Lance l'ETL manuellement depuis le dashboard
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('[etl/run] Lancement manuel de l\'ETL demandé')

    // Déterminer le chemin vers l'ETL (depuis la racine du projet)
    const projectRoot = path.resolve(process.cwd(), '..')
    const etlScript = path.join(projectRoot, 'etl', 'gsc', 'fetch-simple.ts')

    logger.debug('[etl/run] Chemins calculés', {
      projectRoot,
      etlScript,
      cwd: process.cwd(),
    })

    // Vérifier que le fichier ETL existe
    if (!fs.existsSync(etlScript)) {
      logger.error('[etl/run] Script ETL non trouvé', { etlScript })
      return NextResponse.json({
        success: false,
        message: 'Script ETL non trouvé',
        error: `Le fichier ${etlScript} n'existe pas`,
        details: {
          projectRoot,
          etlScript,
          cwd: process.cwd(),
        },
      } as ApiErrorResponse, { status: 500 })
    }

    // Vérifier les variables critiques avant exécution
    const requiredVars = {
      GCP_SA_KEY_JSON: process.env.GCP_SA_KEY_JSON,
      SITES_LIST: process.env.SITES_LIST,
      GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
      BQ_DATASET: process.env.BQ_DATASET,
    }

    const missingVars = Object.entries(requiredVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key)

    if (missingVars.length > 0) {
      logger.error('[etl/run] Variables d\'environnement manquantes', { missingVars })
      return NextResponse.json({
        success: false,
        message: 'Variables d\'environnement manquantes',
        error: `Variables requises manquantes: ${missingVars.join(', ')}`,
        details: { missingVars },
      } as ApiErrorResponse, { status: 500 })
    }

    // Préparer les variables d'environnement à passer au script
    const envVars: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
      GCP_PROJECT_ID: requiredVars.GCP_PROJECT_ID,
      BQ_DATASET: requiredVars.BQ_DATASET,
      GCP_SA_KEY_JSON: requiredVars.GCP_SA_KEY_JSON,
      SITES_LIST: requiredVars.SITES_LIST,
    }

    // Ajouter les variables optionnelles si elles existent
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      envVars['GOOGLE_APPLICATION_CREDENTIALS'] = process.env.GOOGLE_APPLICATION_CREDENTIALS
    }
    if (process.env.BQ_TABLE_NAME) {
      envVars['BQ_TABLE_NAME'] = process.env.BQ_TABLE_NAME
    }
    if (process.env.FETCH_DAYS) {
      envVars['FETCH_DAYS'] = process.env.FETCH_DAYS
    }
    if (process.env.TIMEZONE) {
      envVars['TIMEZONE'] = process.env.TIMEZONE
    }

    logger.info('[etl/run] Exécution du script ETL', {
      script: etlScript,
      projectRoot,
      hasGCP_SA_KEY_JSON: !!envVars.GCP_SA_KEY_JSON,
      hasSITES_LIST: !!envVars.SITES_LIST,
    })

    // Lancer l'ETL
    const command = `npx tsx ${etlScript}`
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectRoot,
      timeout: 120000, // 2 minutes max
      env: envVars,
    })

    logger.info('[etl/run] ETL terminé avec succès', {
      stdoutLength: stdout?.length || 0,
      stderrLength: stderr?.length || 0,
    })

    if (stdout) {
      logger.debug('[etl/run] STDOUT', { stdout })
    }
    if (stderr) {
      logger.warn('[etl/run] STDERR (non critique)', { stderr })
    }

    const response: ApiSuccessResponse = {
      success: true,
      data: {
        message: 'ETL lancé avec succès',
        timestamp: new Date().toISOString(),
        stdout: stdout || null,
      },
      meta: {
        script: etlScript,
        duration: 'completed',
      },
    }

    return NextResponse.json(response)
  } catch (error: any) {
    // Extraire les détails de l'erreur
    const errorDetails: any = {
      message: error.message,
      code: (error as any).code,
      signal: (error as any).signal,
    }

    // Si c'est une erreur d'exécution, essayer d'extraire stderr
    if ((error as any).stderr) {
      errorDetails.stderr = (error as any).stderr
    }
    if ((error as any).stdout) {
      errorDetails.stdout = (error as any).stdout
    }

    logger.error('[etl/run] Erreur lors du lancement de l\'ETL', error, {
      route: '/api/etl/run',
      errorDetails,
    })

    // Message d'erreur plus explicite
    let userMessage = 'Erreur lors du lancement de l\'ETL'
    if (error.message?.includes('Command failed')) {
      userMessage = 'Le script ETL a échoué. Vérifiez les logs serveur.'
    } else if (error.message?.includes('timeout')) {
      userMessage = 'Le script ETL a dépassé le temps limite (2 minutes)'
    } else if (error.message?.includes('ENOENT')) {
      userMessage = 'Script ETL ou dépendance non trouvé(e)'
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: userMessage + (error.message ? `: ${error.message}` : ''),
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}

