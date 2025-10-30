#!/usr/bin/env tsx
/**
 * Run Traffic Analyst Agent manually
 */

import 'dotenv/config'
import { runTrafficAnalyst } from '../agents/traffic-analyst/agent.js'

console.log('🚀 Launching Traffic Analyst...')
console.log('⏰ Time:', new Date().toISOString())
console.log()

runTrafficAnalyst()
  .then(result => {
    console.log('\n✅ Traffic Analyst completed')
    console.log(`   Status: ${result.status}`)
    console.log(`   Duration: ${result.duration}s`)
    
    if (result.status === 'success') {
      console.log(`   Sites analyzed: ${result.data.sitesAnalyzed}`)
      console.log(`   Insights created: ${result.data.insightsCreated}`)
    }
    
    if (result.error) {
      console.error(`   Error: ${result.error}`)
    }
    
    process.exit(result.status === 'failed' ? 1 : 0)
  })
  .catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

