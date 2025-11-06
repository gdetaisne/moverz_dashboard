import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { logger } from '@/lib/logger'
import type { ApiSuccessResponse, ApiErrorResponse } from '@/lib/api-helpers'

const execAsync = promisify(exec)

/**
 * POST /api/etl/run-issues
 * Lance l'ETL GSC Issues manuellement depuis le dashboard
 * Vérifie les alertes existantes et récupère les nouvelles
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('[etl/run-issues] Lancement manuel de l\'ETL GSC Issues demandé')

    // Déterminer le chemin vers l'ETL (depuis la racine du projet)
    const projectRoot = path.resolve(process.cwd(), '..')
    const etlScript = path.join(projectRoot, 'etl', 'gsc', 'fetch-issues.ts')

    logger.debug('[etl/run-issues] Chemins calculés', {
      projectRoot,
      etlScript,
      cwd: process.cwd(),
    })

    // Vérifier que le fichier ETL existe
    if (!fs.existsSync(etlScript)) {
      logger.error('[etl/run-issues] Script ETL non trouvé', { etlScript })
      return NextResponse.json({
        success: false,
        message: 'Script ETL non trouvé',
        error: `Le fichier ${etlScript} n'existe pas`,
        details: {
          projectRoot,
          etlScript,
          cwd: process.cwd(),
        },
      }, { status: 500 })
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
      logger.error('[etl/run-issues] Variables d\'environnement manquantes', { missingVars })
      return NextResponse.json({
        success: false,
        message: 'Variables d\'environnement manquantes',
        error: `Variables requises manquantes: ${missingVars.join(', ')}`,
        details: { missingVars },
      }, { status: 500 })
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
    if (process.env.MAX_URLS_PER_SITE) {
      envVars['MAX_URLS_PER_SITE'] = process.env.MAX_URLS_PER_SITE
    }
    if (process.env.TEST_MODE) {
      envVars['TEST_MODE'] = process.env.TEST_MODE
    }

    logger.info('[etl/run-issues] Exécution du script ETL', {
      script: etlScript,
      projectRoot,
      hasGCP_SA_KEY_JSON: !!envVars.GCP_SA_KEY_JSON,
      hasSITES_LIST: !!envVars.SITES_LIST,
    })

    // Lancer l'ETL
    const command = `npx tsx ${etlScript}`
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: projectRoot,
        timeout: 300000, // 5 minutes max (l'inspection URL peut prendre du temps)
        env: envVars,
      })

      logger.info('[etl/run-issues] ETL terminé avec succès (code 0)', {
        stdoutLength: stdout?.length || 0,
        stderrLength: stderr?.length || 0,
      })

      if (stdout) {
        logger.debug('[etl/run-issues] STDOUT', { stdout })
      }
      if (stderr) {
        logger.warn('[etl/run-issues] STDERR (non critique)', { stderr })
      }

      const response: ApiSuccessResponse = {
        success: true,
        data: {
          message: 'ETL GSC Issues terminé avec succès',
          timestamp: new Date().toISOString(),
          stdout: stdout || null,
        },
        meta: {
          script: etlScript,
          duration: 'completed',
        },
      }

      return NextResponse.json(response)
    } catch (execError: any) {
      // Extraire stdout/stderr même en cas d'erreur (ils peuvent contenir des infos utiles)
      const stdout = execError.stdout || ''
      const stderr = execError.stderr || ''
      const exitCode = execError.code

      // Code de sortie 2 = succès partiel (acceptable)
      // Code de sortie 0 = succès complet (déjà géré dans le try)
      // Code de sortie 1 = échec complet
      if (exitCode === 2) {
        logger.warn('[etl/run-issues] ETL terminé avec succès partiel (code 2)', {
          exitCode,
          stdoutLength: stdout?.length || 0,
          stderrLength: stderr?.length || 0,
        })

        // Parser le stdout pour extraire les stats JSON
        let stats = null
        try {
          // Chercher le dernier log JSON qui contient les stats
          const lines = stdout.split('\n').filter(Boolean)
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const parsed = JSON.parse(lines[i])
              if (parsed.msg === 'ETL completed successfully' || parsed.resolvedIssues !== undefined) {
                stats = parsed
                break
              }
            } catch {
              // Ignorer les lignes non-JSON
            }
          }
        } catch {
          // Si parsing échoue, continuer sans stats
        }

        const response: ApiSuccessResponse = {
          success: true,
          data: {
            message: stats 
              ? `ETL terminé avec succès partiel (${stats.resolvedIssues || 0} alertes résolues, ${stats.totalIssues || 0} nouvelles)`
              : 'ETL terminé avec succès partiel',
            timestamp: new Date().toISOString(),
            stdout: stdout || null,
            warnings: stats?.resolvedIssues > 0 ? [
              `${stats.resolvedIssues} alerte(s) marquée(s) comme résolue(s)`
            ] : undefined,
          },
          meta: {
            script: etlScript,
            duration: 'completed',
            exitCode: 2,
            stats: stats || undefined,
          },
        }

        return NextResponse.json(response)
      }

      // Code 1 ou autre = vraie erreur
      logger.error('[etl/run-issues] ETL échoué', execError, {
        route: '/api/etl/run-issues',
        exitCode,
        stdoutLength: stdout?.length || 0,
        stderrLength: stderr?.length || 0,
      })

      // Message d'erreur plus explicite
      let userMessage = 'Erreur lors du lancement de l\'ETL GSC Issues'
      if (exitCode === 1) {
        userMessage = 'Le script ETL a complètement échoué. Vérifiez les logs serveur.'
      } else if (execError.message?.includes('timeout')) {
        userMessage = 'Le script ETL a dépassé le temps limite (5 minutes)'
      } else if (execError.message?.includes('ENOENT')) {
        userMessage = 'Script ETL ou dépendance non trouvé(e)'
      }

      const errorDetails: any = {
        message: execError.message,
        code: exitCode,
        signal: execError.signal,
      }

      if (stderr) {
        errorDetails.stderr = stderr
      }
      if (stdout) {
        errorDetails.stdout = stdout
      }

      const errorResponse = {
        success: false,
        message: userMessage,
        error: execError.message || userMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
      }

      return NextResponse.json(errorResponse, { status: 500 })
    }
  } catch (error: any) {
    // Erreur non liée à l'exécution du script (ex: timeout général)
    const errorDetails: any = {
      message: error.message,
      code: (error as any).code,
      signal: (error as any).signal,
    }

    logger.error('[etl/run-issues] Erreur lors du lancement de l\'ETL', error, {
      route: '/api/etl/run-issues',
      errorDetails,
    })

    let userMessage = 'Erreur lors du lancement de l\'ETL GSC Issues'
    if (error.message?.includes('timeout')) {
      userMessage = 'Le script ETL a dépassé le temps limite (5 minutes)'
    }

    const errorResponse = {
      success: false,
      message: userMessage,
      error: error.message || userMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}

