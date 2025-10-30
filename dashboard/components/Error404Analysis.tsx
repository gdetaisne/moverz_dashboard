'use client'

import { Brain, AlertCircle, CheckCircle, Zap, Loader2, TrendingUp } from 'lucide-react'
import { useState } from 'react'

interface Pattern {
  type: string
  description: string
  count: number
  examples: string[]
  severity: 'critical' | 'high' | 'medium' | 'low'
}

interface Fix {
  priority: 'P1' | 'P2' | 'P3'
  title: string
  description: string
  affected_sites: string[]
  affected_count: number
  action: string
  estimated_effort: 'Faible' | 'Moyen' | 'Élevé'
}

interface AnalysisData {
  summary: string
  total_errors: number
  patterns: Pattern[]
  fixes: Fix[]
  insights: string[]
}

interface Error404AnalysisProps {
  results: Array<{
    site: string
    errors_list: string[]
    broken_links_list?: Array<{ source: string; target: string }>
  }>
}

export function Error404Analysis({ results }: Error404AnalysisProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  
  async function runAnalysis() {
    setAnalyzing(true)
    setError(null)
    
    try {
      const response = await fetch('/dashboard-api/404/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      })
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Erreur lors de l\'analyse')
      }
      
      setAnalysis(data.data)
    } catch (err: any) {
      setError(err.message)
      console.error('Analysis error:', err)
    } finally {
      setAnalyzing(false)
    }
  }
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-slate-600 bg-slate-50 border-slate-200'
    }
  }
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P1': return 'bg-red-600 text-white'
      case 'P2': return 'bg-orange-600 text-white'
      case 'P3': return 'bg-blue-600 text-white'
      default: return 'bg-slate-600 text-white'
    }
  }
  
  const getEffortBadge = (effort: string) => {
    switch (effort) {
      case 'Faible': return 'bg-green-100 text-green-800'
      case 'Moyen': return 'bg-yellow-100 text-yellow-800'
      case 'Élevé': return 'bg-red-100 text-red-800'
      default: return 'bg-slate-100 text-slate-800'
    }
  }
  
  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }
  
  if (!analysis && !analyzing && !error) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200 shadow-sm p-8">
        <div className="flex items-start gap-4">
          <div className="bg-purple-600 rounded-full p-3">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              🤖 Analyse IA des Erreurs 404
            </h2>
            <p className="text-slate-700 mb-4">
              Laissez GPT-4 analyser vos erreurs 404 pour détecter les patterns, regrouper les problèmes et proposer des correctifs par ordre de priorité.
            </p>
            <button
              onClick={runAnalysis}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-all shadow-sm hover:shadow-md"
            >
              <Brain className="h-4 w-4" />
              Lancer l&apos;analyse IA
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  if (analyzing) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
        <div className="flex items-center justify-center gap-3 text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          <span className="text-lg font-medium">Analyse en cours avec GPT-4...</span>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="bg-red-50 rounded-lg border border-red-200 shadow-sm p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-red-900 mb-1">Erreur d&apos;analyse</h3>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={runAnalysis}
              className="mt-3 text-sm text-red-600 hover:text-red-700 font-semibold underline"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  if (!analysis) return null
  
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="bg-purple-600 rounded-full p-3">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              Analyse IA Complétée
              <CheckCircle className="h-5 w-5 text-green-600" />
            </h2>
            <p className="text-slate-700 text-base leading-relaxed">{analysis.summary}</p>
            <div className="flex items-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Total erreurs :</span>
                <span className="font-bold text-orange-600">{analysis.total_errors}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Patterns détectés :</span>
                <span className="font-bold text-purple-600">{analysis.patterns.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Correctifs proposés :</span>
                <span className="font-bold text-blue-600">{analysis.fixes.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Fixes (Prioritaires) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-600" />
            Correctifs Recommandés (par priorité)
          </h3>
        </div>
        
        <div className="p-6 space-y-4">
          {analysis.fixes.map((fix, idx) => (
            <div
              key={idx}
              className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className={`px-2 py-1 text-xs font-bold rounded ${getPriorityColor(fix.priority)}`}>
                  {fix.priority}
                </span>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900 mb-1">{fix.title}</h4>
                  <p className="text-sm text-slate-600 mb-3">{fix.description}</p>
                  
                  <div className="flex items-center gap-4 mb-2 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600">Sites affectés :</span>
                      <span className="text-slate-900">{fix.affected_sites.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600">Erreurs concernées :</span>
                      <span className="font-bold text-orange-600">{fix.affected_count}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600">Effort :</span>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getEffortBadge(fix.estimated_effort)}`}>
                        {fix.estimated_effort}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                    <p className="text-sm font-semibold text-blue-900 mb-1">✅ Action à réaliser :</p>
                    <p className="text-sm text-blue-800">{fix.action}</p>
                  </div>
                  
                  {fix.affected_sites.length > 0 && (
                    <button
                      onClick={() => toggleExpand(`fix-${idx}`)}
                      className="mt-2 text-xs text-purple-600 hover:text-purple-700 font-semibold"
                    >
                      {expanded[`fix-${idx}`] ? '▼' : '▶'} Voir les sites ({fix.affected_sites.length})
                    </button>
                  )}
                  
                  {expanded[`fix-${idx}`] && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {fix.affected_sites.map(site => (
                        <span key={site} className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded">
                          {site}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Patterns */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            Patterns Détectés
          </h3>
        </div>
        
        <div className="p-6 space-y-3">
          {analysis.patterns.map((pattern, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-4 ${getSeverityColor(pattern.severity)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-bold">{pattern.type}</h4>
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-white border border-current">
                      {pattern.count} occurrences
                    </span>
                  </div>
                  <p className="text-sm mb-2">{pattern.description}</p>
                  
                  {pattern.examples.length > 0 && (
                    <>
                      <button
                        onClick={() => toggleExpand(`pattern-${idx}`)}
                        className="text-xs font-semibold underline"
                      >
                        {expanded[`pattern-${idx}`] ? '▼' : '▶'} Exemples ({pattern.examples.length})
                      </button>
                      
                      {expanded[`pattern-${idx}`] && (
                        <ul className="mt-2 space-y-1">
                          {pattern.examples.map((example, i) => (
                            <li key={i} className="text-xs font-mono bg-white/60 px-2 py-1 rounded">
                              {example}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
                <span className="px-2 py-1 text-xs font-bold uppercase rounded bg-white border border-current">
                  {pattern.severity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Insights */}
      {analysis.insights && analysis.insights.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
            💡 Observations
          </h3>
          <ul className="space-y-2">
            {analysis.insights.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-2 text-blue-800">
                <span className="text-blue-600 font-bold">•</span>
                <span className="text-sm">{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Bouton pour relancer */}
      <div className="flex justify-end">
        <button
          onClick={runAnalysis}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-all"
        >
          <Brain className="h-4 w-4" />
          Relancer l&apos;analyse
        </button>
      </div>
    </div>
  )
}

