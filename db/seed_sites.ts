/**
 * Seed des 11 sites dans BigQuery
 */

import { insertRows } from '../etl/shared/bigquery-client.js'
import { SITES } from '../etl/shared/types.js'

async function seed() {
  console.log('🌱 Seeding sites...')

  const rows = SITES.map(site => ({
    id: site.id,
    city: site.city,
    domain: site.domain,
    status: site.status,
    created_at: site.createdAt.toISOString(),
    updated_at: null,
  }))

  await insertRows('sites', rows)

  console.log('✅ Seed terminé: 11 sites insérés')
}

// Exécuter si lancé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch(error => {
    console.error('❌ Erreur seed:', error)
    process.exit(1)
  })
}

export { seed }

