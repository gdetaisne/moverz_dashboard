/**
 * Logger structuré pour le dashboard
 * 
 * En production, ne log que warn+error pour réduire les coûts.
 * En dev, log tout avec plus de détails.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogContext {
  [key: string]: unknown
}

class Logger {
  private isDev = process.env.NODE_ENV === 'development'
  private isProd = process.env.NODE_ENV === 'production'

  private shouldLog(level: LogLevel): boolean {
    // En prod: seulement warn et error
    if (this.isProd) {
      return level === 'warn' || level === 'error'
    }
    // En dev: tout
    return true
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return
    console.log(this.formatMessage('info', message, context))
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return
    console.warn(this.formatMessage('warn', message, context))
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return
    
    const errorContext: LogContext = {
      ...context,
    }
    
    if (error instanceof Error) {
      errorContext.error = {
        message: error.message,
        name: error.name,
        stack: this.isDev ? error.stack : undefined,
      }
      // Ajouter code si disponible (ex: BigQuery error code)
      if ('code' in error) {
        errorContext.code = (error as { code?: string }).code
      }
    } else if (error) {
      errorContext.error = String(error)
    }
    
    console.error(this.formatMessage('error', message, errorContext))
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return
    console.log(this.formatMessage('debug', message, context))
  }
}

// Export singleton
export const logger = new Logger()

