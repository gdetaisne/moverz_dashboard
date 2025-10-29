/**
 * Gestion centralisée des erreurs ETL
 */

export class ETLError extends Error {
  constructor(
    message: string,
    public readonly jobName: string,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'ETLError'
  }
}

export class GSCAPIError extends ETLError {
  constructor(message: string, domain: string, originalError?: Error) {
    super(`GSC API Error for ${domain}: ${message}`, 'gsc-fetch', originalError)
    this.name = 'GSCAPIError'
  }
}

export class BigQueryError extends ETLError {
  constructor(message: string, tableName: string, originalError?: Error) {
    super(`BigQuery Error for ${tableName}: ${message}`, 'bigquery-insert', originalError)
    this.name = 'BigQueryError'
  }
}

/**
 * Wrapper pour capturer et logger les erreurs
 */
export async function withErrorHandling<T>(
  jobName: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn()
  } catch (error: any) {
    console.error(`[${jobName}] ❌ Erreur:`, error.message)
    
    if (error.stack) {
      console.error(error.stack)
    }
    
    throw new ETLError(error.message, jobName, error)
  }
}

/**
 * Retry avec backoff exponentiel
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    backoffMultiplier?: number
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
  } = options

  let lastError: Error | undefined
  let delay = initialDelay

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      if (attempt < maxRetries) {
        console.warn(`Tentative ${attempt}/${maxRetries} échouée, retry dans ${delay}ms...`)
        await sleep(delay)
        delay *= backoffMultiplier
      }
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Logger structuré
 */
export function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString()
  const logData = {
    timestamp,
    level,
    message,
    ...(data && { data }),
  }

  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  logFn(JSON.stringify(logData))
}

