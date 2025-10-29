import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

/**
 * POST /api/etl/run
 * Lance l'ETL manuellement depuis le dashboard
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Lancement manuel de l\'ETL...')

    // Déterminer le chemin vers l'ETL (depuis la racine du projet)
    const projectRoot = path.resolve(process.cwd(), '..')
    const etlScript = path.join(projectRoot, 'etl', 'gsc', 'fetch-simple.ts')

    console.log('Project root:', projectRoot)
    console.log('ETL script:', etlScript)

    // Lancer l'ETL en arrière-plan
    const { stdout, stderr } = await execAsync(`npx tsx ${etlScript}`, {
      cwd: projectRoot,
      timeout: 120000, // 2 minutes max
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
    })

    console.log('✅ ETL terminé avec succès')
    console.log('STDOUT:', stdout)
    if (stderr) console.error('STDERR:', stderr)

    return NextResponse.json({
      success: true,
      message: 'ETL lancé avec succès',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('❌ Erreur lors du lancement de l\'ETL:', error)

    return NextResponse.json(
      {
        success: false,
        message: 'Erreur lors du lancement de l\'ETL',
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

