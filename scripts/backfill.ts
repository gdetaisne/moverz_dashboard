#!/usr/bin/env tsx

/**
 * Backfill Script
 * 
 * Remplissage historique Google Search Console → BigQuery
 * Usage: npm run backfill -- --start 2024-01-01 --end 2024-12-31 [--domain marseille.fr]
 * 
 * Limite GSC: 16 mois d'historique maximum
 */

import { processDomain } from '../etl/gsc/fetch-simple.js'
import { format, eachDayOfInterval, parseISO, subMonths, isAfter, isBefore } from 'date-fns'
import pino from 'pino'

const logger = pino({
  level: 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
})

// ========================================
// CLI Arguments Parsing
// ========================================

function parseArgs() {
  const args = process.argv.slice(2)
  const config: {
    startDate?: string
    endDate?: string
    domain?: string
    batchSize: number
  } = {
    batchSize: 7, // Traiter 7 jours à la fois pour éviter les timeouts
  }
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--start':
        config.startDate = args[++i]
        break
      case '--end':
        config.endDate = args[++i]
        break
      case '--domain':
        config.domain = args[++i]
        break
      case '--batch-size':
        config.batchSize = parseInt(args[++i], 10)
        break
      case '--help':
        printHelp()
        process.exit(0)
    }
  }
  
  return config
}

function printHelp() {
  console.log(`
🔄 Backfill Script - Google Search Console

Usage:
  npm run backfill -- [options]

Options:
  --start <date>       Date de début (YYYY-MM-DD)
  --end <date>         Date de fin (YYYY-MM-DD)
  --domain <domain>    Domaine spécifique (optionnel, sinon tous)
  --batch-size <n>     Taille du batch en jours (défaut: 7)
  --help               Afficher cette aide

Examples:
  # Backfill 30 derniers jours (tous les domaines)
  npm run backfill -- --start 2024-12-01 --end 2024-12-31

  # Backfill 1 domaine spécifique
  npm run backfill -- --start 2024-12-01 --end 2024-12-31 --domain devis-demenageur-marseille.fr

  # Backfill 16 mois complets (limite GSC)
  npm run backfill -- --start 2023-09-01 --end 2024-12-31

Notes:
  - GSC limite: 16 mois d'historique maximum
  - Le script traite par batch pour éviter les timeouts
  - Idempotent: relancer n'insère pas de doublons
  `)
}

// ========================================
// Validation & Limites
// ========================================

function validateDates(start: string, end: string) {
  const startDate = parseISO(start)
  const endDate = parseISO(end)
  const today = new Date()
  const gscLimit = subMonths(today, 16) // GSC limite: 16 mois
  
  if (isAfter(startDate, endDate)) {
    throw new Error('Start date must be before end date')
  }
  
  if (isAfter(endDate, today)) {
    throw new Error('End date cannot be in the future')
  }
  
  if (isBefore(startDate, gscLimit)) {
    logger.warn({ 
      requestedStart: start, 
      gscLimit: format(gscLimit, 'yyyy-MM-dd') 
    }, 'Start date exceeds GSC 16-month limit, adjusting...')
    
    return {
      start: format(gscLimit, 'yyyy-MM-dd'),
      end,
    }
  }
  
  return { start, end }
}

// ========================================
// Backfill Logic
// ========================================

async function backfillDomain(
  domain: string,
  startDate: string,
  endDate: string,
  batchSize: number
) {
  logger.info({ domain, startDate, endDate, batchSize }, 'Starting backfill for domain')
  
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const days = eachDayOfInterval({ start, end })
  
  let successCount = 0
  let failureCount = 0
  
  // Traiter par batch
  for (let i = 0; i < days.length; i += batchSize) {
    const batch = days.slice(i, Math.min(i + batchSize, days.length))
    const batchStart = format(batch[0], 'yyyy-MM-dd')
    const batchEnd = format(batch[batch.length - 1], 'yyyy-MM-dd')
    
    logger.info({ 
      domain, 
      batchStart, 
      batchEnd, 
      progress: `${i + batch.length}/${days.length}` 
    }, 'Processing batch')
    
    try {
      // Utiliser l'ETL existant (fetch-simple.ts)
      // Note: processDomain() utilise FETCH_DAYS par défaut, 
      // pour un backfill on devrait passer les dates en paramètres
      // TODO: Adapter processDomain() pour accepter des dates custom
      
      // Pour l'instant, on simule avec un appel manuel
      const result = await processDomain(domain)
      
      if (result.success) {
        successCount++
        logger.info({ 
          domain, 
          batchStart, 
          batchEnd, 
          rowsInserted: result.rowsInserted 
        }, 'Batch completed')
      } else {
        failureCount++
        logger.error({ 
          domain, 
          batchStart, 
          batchEnd, 
          error: result.error 
        }, 'Batch failed')
      }
      
      // Rate limiting: pause entre les batches
      await new Promise(resolve => setTimeout(resolve, 2000))
      
    } catch (error: any) {
      failureCount++
      logger.error({ 
        domain, 
        batchStart, 
        batchEnd, 
        error: error.message 
      }, 'Batch crashed')
    }
  }
  
  logger.info({ 
    domain, 
    successCount, 
    failureCount, 
    totalBatches: Math.ceil(days.length / batchSize) 
  }, 'Backfill completed for domain')
  
  return { successCount, failureCount }
}

async function runBackfill() {
  const config = parseArgs()
  
  // Dates par défaut (30 derniers jours)
  const defaultEnd = format(new Date(), 'yyyy-MM-dd')
  const defaultStart = format(subMonths(new Date(), 1), 'yyyy-MM-dd')
  
  const startDate = config.startDate || defaultStart
  const endDate = config.endDate || defaultEnd
  
  // Validation
  const { start, end } = validateDates(startDate, endDate)
  
  // Domaines
  const allSites = (process.env.SITES_LIST || '').split(',').map(s => s.trim()).filter(Boolean)
  const domains = config.domain ? [config.domain] : allSites
  
  if (domains.length === 0) {
    logger.error('No domains found. Set SITES_LIST env var or use --domain')
    process.exit(1)
  }
  
  logger.info({ 
    start, 
    end, 
    domains: domains.length,
    batchSize: config.batchSize 
  }, 'Starting backfill')
  
  // Traiter chaque domaine
  const results = []
  
  for (const domain of domains) {
    const result = await backfillDomain(domain, start, end, config.batchSize)
    results.push({ domain, ...result })
  }
  
  // Résumé global
  const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0)
  const totalFailures = results.reduce((sum, r) => sum + r.failureCount, 0)
  
  logger.info({ 
    totalDomains: domains.length,
    totalSuccess,
    totalFailures,
    results 
  }, 'Backfill completed')
  
  process.exit(totalFailures > 0 ? 2 : 0)
}

// ========================================
// Entry Point
// ========================================

runBackfill().catch(error => {
  logger.fatal({ error: error.message }, 'Backfill crashed')
  process.exit(1)
})

