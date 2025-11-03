/**
 * Script pour exécuter l'agent GSC Issues Analyzer
 */

import 'dotenv/config'
import { runGSCIssuesAnalyzer } from '../agents/gsc-issues-analyzer/agent.js'

async function main() {
  console.log('🤖 Starting GSC Issues Analyzer...')
  
  const result = await runGSCIssuesAnalyzer()
  
  if (result.status === 'success') {
    console.log('✅ Analysis completed:', result.message)
    console.log(`   Insights generated: ${result.insights.length}`)
    process.exit(0)
  } else {
    console.error('❌ Analysis failed:', result.message)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

