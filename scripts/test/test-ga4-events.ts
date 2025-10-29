/**
 * Test des événements GA4
 */

import { log } from '../../etl/shared/error-handler.js'

// ========================================
// CONFIGURATION
// ========================================

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID

if (!GA4_ID) {
  console.error('❌ NEXT_PUBLIC_GA4_ID not found in .env')
  process.exit(1)
}

// ========================================
// TESTS
// ========================================

interface TestEvent {
  name: string
  params: Record<string, any>
}

const TEST_EVENTS: TestEvent[] = [
  {
    name: 'page_view',
    params: {
      page_location: 'https://devis-demenageur-marseille.fr/blog/test',
      site: 'marseille',
    },
  },
  {
    name: 'cta_click',
    params: {
      cta_type: 'hero',
      destination: '/devis',
      site: 'marseille',
    },
  },
  {
    name: 'form_start',
    params: {
      form_type: 'lead',
      site: 'marseille',
    },
  },
  {
    name: 'form_submit',
    params: {
      form_type: 'lead',
      site: 'marseille',
    },
  },
]

// ========================================
// MEASUREMENT PROTOCOL
// ========================================

async function sendEventToGA4(event: TestEvent): Promise<boolean> {
  const measurementId = GA4_ID
  const apiSecret = process.env.GA4_API_SECRET
  
  if (!apiSecret) {
    log('warn', 'GA4_API_SECRET not set - Using DebugView URL only')
    return false
  }

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`
  
  const payload = {
    client_id: 'test-client-' + Date.now(),
    events: [
      {
        name: event.name,
        params: event.params,
      },
    ],
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      return true
    } else {
      log('error', 'GA4 API error', { status: response.status })
      return false
    }
  } catch (error: any) {
    log('error', 'Failed to send event', { error: error.message })
    return false
  }
}

// ========================================
// RUN TESTS
// ========================================

async function runTests() {
  log('info', '🧪 Testing GA4 Events...')
  log('info', `GA4 ID: ${GA4_ID}`)

  let successCount = 0
  let failedCount = 0

  for (const event of TEST_EVENTS) {
    log('info', `Testing event: ${event.name}`)
    
    const success = await sendEventToGA4(event)
    
    if (success) {
      log('info', `✅ ${event.name} sent successfully`)
      successCount++
    } else {
      log('warn', `⚠️  ${event.name} could not be sent (check GA4_API_SECRET)`)
      failedCount++
    }
    
    // Wait 500ms entre chaque événement
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log('')
  console.log('📊 ========================================')
  console.log(`📊 Tests completed: ${successCount} success, ${failedCount} failed`)
  console.log('📊 ========================================')
  console.log('')
  
  if (failedCount > 0) {
    console.log('💡 Pour envoyer via Measurement Protocol:')
    console.log('   1. Aller sur GA4 > Admin > Data Streams')
    console.log('   2. Sélectionner un stream')
    console.log('   3. Aller dans "Measurement Protocol API secrets"')
    console.log('   4. Créer un secret')
    console.log('   5. Ajouter GA4_API_SECRET=xxx dans .env')
    console.log('')
  }
  
  console.log('🔍 Vérifier les événements dans GA4 DebugView:')
  console.log('   https://analytics.google.com/analytics/web/#/a/p/realtime/overview')
  console.log('')
  console.log('💡 Activer le mode debug dans le navigateur:')
  console.log('   - Installer extension: Google Analytics Debugger')
  console.log('   - Ou ajouter ?debug_mode=true dans l\'URL')
  console.log('')

  return failedCount === 0
}

// ========================================
// CLI
// ========================================

runTests().then((success) => {
  process.exit(success ? 0 : 1)
})

