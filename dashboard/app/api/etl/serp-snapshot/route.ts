import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { logger } from '@/lib/logger'
import type { ApiSuccessResponse, ApiErrorResponse } from '@/lib/api-helpers'

const execAsync = promisify(exec)

/**
 * POST /api/etl/serp-snapshot
 * Lance le snapshot quotidien des métadonnées SERP
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('[etl/serp-snapshot] Lancement snapshot métadonnées SERP')

    const projectRoot = path.resolve(process.cwd(), '..')
    const snapshotScript = path.join(projectRoot, 'etl', 'serp', 'snapshot-metadata.ts')

    if (!fs.existsSync(snapshotScript)) {
      logger.error('[etl/serp-snapshot] Script non trouvé', { snapshotScript })
      return NextResponse.json({
        success: false,
        message: 'Script snapshot non trouvé',
        error: `Le fichier ${snapshotScript} n'existe pas`,
      }, { status: 500 })
    }

    // Variables requises
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
      logger.error('[etl/serp-snapshot] Variables manquantes', { missingVars })
      return NextResponse.json({
        success: false,
        message: 'Variables d\'environnement manquantes',
        error: `Variables requises: ${missingVars.join(', ')}`,
      }, { status: 500 })
    }

    const envVars: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
      GCP_PROJECT_ID: requiredVars.GCP_PROJECT_ID,
      BQ_DATASET: requiredVars.BQ_DATASET,
      GCP_SA_KEY_JSON: requiredVars.GCP_SA_KEY_JSON,
      SITES_LIST: requiredVars.SITES_LIST,
    }

    if (process.env.BQ_LOCATION) {
      envVars['BQ_LOCATION'] = process.env.BQ_LOCATION
    }
    if (process.env.SERP_SNAPSHOT_LIMIT) {
      envVars['SERP_SNAPSHOT_LIMIT'] = process.env.SERP_SNAPSHOT_LIMIT
    }

    logger.info('[etl/serp-snapshot] Exécution du script', { script: snapshotScript })

    const command = `cd ${projectRoot} && npx tsx ${snapshotScript}`
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        env: envVars,
        timeout: 300000, // 5 minutes timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB
      })

      logger.info('[etl/serp-snapshot] Script terminé', {
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
      })

      // Parser la sortie pour extraire les stats
      const successMatch = stdout.match(/success[:\s]+(\d+)/i)
      const failedMatch = stdout.match(/failed[:\s]+(\d+)/i)
      
      const success = successMatch ? parseInt(successMatch[1], 10) : 0
      const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0

      // Exit code 0 = success, 1 = error, 2 = partial
      const exitCode = failed > success ? 1 : (failed > 0 ? 2 : 0)

      if (exitCode === 0) {
        return NextResponse.json({
          success: true,
          message: `Snapshot terminé avec succès (${success} pages)`,
          data: {
            success,
            failed,
            stdout: stdout.slice(-2000), // Derniers 2000 caractères
          },
        } as ApiSuccessResponse, { status: 200 })
      } else if (exitCode === 2) {
        return NextResponse.json({
          success: true,
          message: `Snapshot terminé partiellement (${success} succès, ${failed} échecs)`,
          data: {
            success,
            failed,
            stdout: stdout.slice(-2000),
          },
        } as ApiSuccessResponse, { status: 200 })
      } else {
        return NextResponse.json({
          success: false,
          message: `Snapshot échoué (${failed} échecs)`,
          error: stderr || 'Erreur inconnue',
          details: {
            success,
            failed,
            stdout: stdout.slice(-2000),
            stderr: stderr.slice(-2000),
          },
        } as ApiErrorResponse, { status: 500 })
      }
    } catch (error: any) {
      logger.error('[etl/serp-snapshot] Erreur d\'exécution', { error: error.message })
      
      return NextResponse.json({
        success: false,
        message: 'Erreur lors de l\'exécution du snapshot',
        error: error.message,
        details: {
          code: error.code,
          signal: error.signal,
          stdout: error.stdout?.slice(-2000),
          stderr: error.stderr?.slice(-2000),
        },
      } as ApiErrorResponse, { status: 500 })
    }
  } catch (error: any) {
    logger.error('[etl/serp-snapshot] Erreur', { error: error.message })
    return NextResponse.json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    } as ApiErrorResponse, { status: 500 })
  }
}

