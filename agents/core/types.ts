/**
 * Types pour les agents IA
 */

export interface AgentConfig {
  name: string
  model: string
  temperature: number
  maxTokens: number
}

export interface AgentResult {
  agentName: string
  executedAt: Date
  duration: number
  status: 'success' | 'failed'
  data: any
  error?: string
}

export interface Action {
  id: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  site: string
  category: 'seo' | 'content' | 'cro' | 'technical'
  title: string
  description: string
  estimatedImpact: string
  estimatedEffort: string
  deadline?: Date
  completed: boolean
}

export interface Insight {
  id: string
  agentName: string
  createdAt: Date
  site: string
  metric: string
  observation: string
  recommendation: string
  confidence: number // 0-1
}

export interface BigQueryContext {
  site?: string
  startDate?: string
  endDate?: string
  limit?: number
}

