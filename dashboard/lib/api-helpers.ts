/**
 * Helpers pour les API Routes Next.js
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from './logger'

export interface ApiErrorResponse {
  success: false
  error: string
  code?: string
  details?: unknown
  stack?: string
}

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Gère les erreurs API de manière standardisée
 */
export function handleApiError(
  error: Error | unknown,
  context?: { route?: string; [key: string]: unknown }
): NextResponse<ApiErrorResponse> {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined

  logger.error('API error', error, context)

  const response: ApiErrorResponse = {
    success: false,
    error: errorMessage,
    code: errorCode,
    stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
  }

  // Status code basé sur le type d'erreur
  const statusCode = errorCode === 'ENOTFOUND' || errorCode === 'ETIMEDOUT' ? 503 : 500

  return NextResponse.json(response, { status: statusCode })
}

/**
 * Wrapper pour les handlers API avec gestion d'erreur automatique
 */
export function apiHandler<T>(
  handler: (req: NextRequest) => Promise<NextResponse<ApiSuccessResponse<T>>>,
  routeName?: string
) {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<T>>> => {
    try {
      return await handler(req)
    } catch (error) {
      return handleApiError(error, { route: routeName })
    }
  }
}

/**
 * Parse et valide un query param numérique
 */
export function parseQueryInt(
  searchParams: URLSearchParams,
  key: string,
  defaultValue: number,
  options?: { min?: number; max?: number }
): number {
  const raw = searchParams.get(key)
  if (!raw) return defaultValue

  const parsed = parseInt(raw, 10)
  if (isNaN(parsed)) return defaultValue

  if (options?.min !== undefined && parsed < options.min) return defaultValue
  if (options?.max !== undefined && parsed > options.max) return defaultValue

  return parsed
}

/**
 * Parse et valide un query param string
 */
export function parseQueryString(
  searchParams: URLSearchParams,
  key: string,
  defaultValue: string
): string {
  return searchParams.get(key) || defaultValue
}

/**
 * Valide les query params avec un schéma Zod
 * 
 * @example
 * const params = validateQuery(request.nextUrl.searchParams, metricsGlobalQuerySchema)
 * // params.days est garanti d'être un number entre 1 et 365
 */
export function validateQuery<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  // Convertir URLSearchParams en objet
  const raw: Record<string, string | null> = {}
  searchParams.forEach((value, key) => {
    raw[key] = value
  })
  
  // Valider avec Zod
  return schema.parse(raw)
}

/**
 * Valide un body JSON avec un schéma Zod
 * 
 * @example
 * const body = await validateBody(request, chatRequestSchema)
 * // body.message est garanti d'être une string non-vide
 */
export async function validateBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  const raw = await request.json()
  return schema.parse(raw)
}

/**
 * Helper pour gérer les erreurs Zod dans les routes API
 */
export function handleZodError(error: unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof z.ZodError) {
    return NextResponse.json({
      success: false,
      error: 'Validation failed',
      details: error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code,
      })),
    }, { status: 400 })
  }
  
  // Si ce n'est pas une erreur Zod, utiliser le handler standard
  return handleApiError(error)
}

