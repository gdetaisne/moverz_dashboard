import { NextRequest, NextResponse } from 'next/server'
import { getBigQueryClient } from '@/lib/bigquery'
import { logger } from '@/lib/logger'

const bigquery = getBigQueryClient()
const BQ_PROJECT_ID = process.env.GCP_PROJECT_ID || 'moverz-dashboard'
const BQ_DATASET = process.env.BQ_DATASET || 'analytics_core'
const BQ_LOCATION = process.env.BQ_LOCATION || 'europe-west1'

/**
 * GET /api/serp/export-csv
 * Exporte toutes les données de serp_metadata_snapshots en CSV
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('[serp/export-csv] Export CSV demandé', {
      projectId: BQ_PROJECT_ID,
      dataset: BQ_DATASET,
      location: BQ_LOCATION,
    })

    // Récupérer toutes les données de la table
    const query = `
      SELECT 
        snapshot_date,
        url,
        metadata_date,
        page_type,
        description_template_version,
        description_text,
        title_text,
        title_length,
        description_length,
        length_score,
        gsc_date,
        impressions,
        clicks,
        ctr,
        position,
        intent,
        intent_source,
        intent_match_score,
        rich_results_score,
        has_faq,
        has_rating,
        has_breadcrumb,
        has_howto,
        has_article,
        has_video,
        has_local_business,
        fetch_success,
        fetch_status,
        redirected,
        status,
        created_at,
        updated_at
      FROM \`${BQ_PROJECT_ID}.${BQ_DATASET}.serp_metadata_snapshots\`
      ORDER BY snapshot_date DESC, COALESCE(impressions, 0) DESC
    `

    logger.info('[serp/export-csv] Exécution requête BigQuery')
    
    let rows: any[]
    try {
      const [result] = await bigquery.query({
        query,
        location: BQ_LOCATION,
      })
      rows = result as any[]
    } catch (bqError: any) {
      logger.error('[serp/export-csv] Erreur BigQuery:', {
        message: bqError.message,
        errors: bqError.errors,
        code: bqError.code,
      })
      throw new Error(`Erreur BigQuery: ${bqError.message}`)
    }

    logger.info(`[serp/export-csv] ${rows.length} lignes récupérées`)

    // Convertir en CSV
    if (!rows || rows.length === 0) {
      // Retourner un CSV avec juste les en-têtes si pas de données
      const headers = [
        'snapshot_date',
        'url',
        'metadata_date',
        'page_type',
        'description_template_version',
        'description_text',
        'title_text',
        'title_length',
        'description_length',
        'length_score',
        'gsc_date',
        'impressions',
        'clicks',
        'ctr',
        'position',
        'intent',
        'intent_source',
        'intent_match_score',
        'rich_results_score',
        'has_faq',
        'has_rating',
        'has_breadcrumb',
        'has_howto',
        'has_article',
        'has_video',
        'has_local_business',
        'fetch_success',
        'fetch_status',
        'redirected',
        'status',
        'created_at',
        'updated_at',
      ]
      
      const csvContent = headers.join(',') + '\n'
      const now = new Date()
      const filename = `serp-metadata-snapshots-${now.toISOString().split('T')[0]}.csv`
      
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // En-têtes CSV
    const headers = [
      'snapshot_date',
      'url',
      'metadata_date',
      'page_type',
      'description_template_version',
      'description_text',
      'title_text',
      'title_length',
      'description_length',
      'length_score',
      'gsc_date',
      'impressions',
      'clicks',
      'ctr',
      'position',
      'intent',
      'intent_source',
      'intent_match_score',
      'rich_results_score',
      'has_faq',
      'has_rating',
      'has_breadcrumb',
      'has_howto',
      'has_article',
      'has_video',
      'has_local_business',
      'fetch_success',
      'fetch_status',
      'redirected',
      'status',
      'created_at',
      'updated_at',
    ]

    // Fonction pour échapper les valeurs CSV
    const escapeCsvValue = (value: any): string => {
      if (value === null || value === undefined) {
        return ''
      }
      const str = String(value)
      // Si contient des guillemets, des virgules ou des retours à la ligne, entourer de guillemets
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Générer le CSV
    const csvLines = [
      headers.join(','),
      ...rows.map((row: any) =>
        headers
          .map((header) => escapeCsvValue(row[header]))
          .join(',')
      ),
    ]

    const csvContent = csvLines.join('\n')

    // Générer le nom de fichier avec la date
    const now = new Date()
    const filename = `serp-metadata-snapshots-${now.toISOString().split('T')[0]}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    logger.error('[serp/export-csv] Erreur complète:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    console.error('[serp/export-csv] Erreur détaillée:', error)
    
    return NextResponse.json(
      {
        success: false,
        message: 'Erreur lors de l\'export CSV',
        error: error.message || 'Erreur inconnue',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

