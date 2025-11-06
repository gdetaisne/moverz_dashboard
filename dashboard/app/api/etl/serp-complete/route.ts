import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { logger } from '@/lib/logger'
import type { ApiSuccessResponse, ApiErrorResponse } from '@/lib/api-helpers'

const execAsync = promisify(exec)

/**
 * POST /api/etl/serp-complete
 * Complète les snapshots pending avec les données GSC j+2
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('[etl/serp-complete] Lancement complétion snapshots j+2')

    const projectRoot = path.resolve(process.cwd(), '..')
    const completeScript = path.join(projectRoot, 'etl', 'serp', 'complete-snapshots.ts')

    if (!fs.existsSync(completeScript)) {
      logger.error('[etl/serp-complete] Script non trouvé', { completeScript })
      return NextResponse.json({
        success: false,
        message: 'Script complétion non trouvé',
        error: `Le fichier ${completeScript} n'existe pas`,
      }, { status: 500 })
    }

    const requiredVars = {
      GCP_SA_KEY_JSON: process.env.GCP_SA_KEY_JSON,
      GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
      BQ_DATASET: process.env.BQ_DATASET,
    }

    const missingVars = Object.entries(requiredVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key)

    if (missingVars.length > 0) {
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
    }

    if (process.env.BQ_LOCATION) {
      envVars['BQ_LOCATION'] = process.env.BQ_LOCATION
    }

    const command = `cd ${projectRoot} && npx tsx ${completeScript}`
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        env: envVars,
        timeout: 300000,
        maxBuffer: 10 * 1024 * 1024,
      })

      const completedMatch = stdout.match(/completed[:\s]+(\d+)/i)
      const completed = completedMatch ? parseInt(completedMatch[1], 10) : 0

      return NextResponse.json({
        success: true,
        message: `Complétion terminée (${completed} snapshots complétés)`,
        data: {
          completed,
          stdout: stdout.slice(-2000),
        },
      } as ApiSuccessResponse, { status: 200 })
    } catch (error: any) {
      logger.error('[etl/serp-complete] Erreur', { error: error.message })
      
      return NextResponse.json({
        success: false,
        message: 'Erreur lors de la complétion',
        error: error.message,
        details: {
          stdout: error.stdout?.slice(-2000),
          stderr: error.stderr?.slice(-2000),
        },
      } as ApiErrorResponse, { status: 500 })
    }
  } catch (error: any) {
    logger.error('[etl/serp-complete] Erreur serveur', { error: error.message })
    return NextResponse.json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    } as ApiErrorResponse, { status: 500 })
  }
}

