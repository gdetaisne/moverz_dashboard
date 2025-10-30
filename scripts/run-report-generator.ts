#!/usr/bin/env tsx
/**
 * Script pour lancer le Report Generator
 * Usage : npx tsx scripts/run-report-generator.ts
 * Ou via cron : 0 10 * * MON
 */

import 'dotenv/config'
import { runReportGenerator } from '../agents/report-generator/agent.js'

async function main() {
  console.log('🚀 Launching Report Generator...')
  console.log(`⏰ Time: ${new Date().toISOString()}`)

  const result = await runReportGenerator()

  console.log(`\n✅ Report Generator completed`)
  console.log(`   Status: ${result.status}`)
  console.log(`   Duration: ${result.duration}s`)

  if (result.status === 'success') {
    console.log(`   Actions: ${result.data.actions.length}`)
    console.log(`   Severity: ${result.data.severity}`)
    console.log(`   Score: ${result.data.score}`)
  } else {
    console.error(`   Error: ${result.error}`)
  }

  process.exit(result.status === 'failed' ? 1 : 0)
}

main()

