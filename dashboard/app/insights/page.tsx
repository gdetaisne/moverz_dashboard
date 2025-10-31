'use client'

import { useEffect, useState } from 'react'
import PageIntro from '@/components/PageIntro'
import { InsightCard } from '@/components/InsightCard'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

interface Insight {
  id: string
  run_date: string
  site: string
  agent: string
  severity: 'info' | 'warn' | 'critical'
  title: string
  summary: string
  score: number
  created_at: string
  payload?: any
  evidence?: any
  suggested_actions?: any[]
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [showExplanation, setShowExplanation] = useState(false)

  useEffect(() => {
    fetchInsights()
  }, [filter])

  const fetchInsights = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('agent', filter)
      
      const res = await fetch(`/api/insights?${params}`)
      const data = await res.json()
      setInsights(data.insights || [])
    } catch (error) {
      console.error('Error fetching insights:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">📊 Insights & Rapports</h1>
        <PageIntro
          finalite="Identifier automatiquement opportunités et anomalies SEO."
          tableaux={["Carte d'insight global", 'Actions recommandées']}
          sources={['BigQuery (métriques GSC)', 'Analyse IA orchestrée']}
        />
      </div>

      {/* Section Explication */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-100 transition-colors rounded-lg text-sm"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-500" />
            <span className="text-slate-600 font-medium">Comment fonctionnent les insights ?</span>
          </div>
          {showExplanation ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>
        {showExplanation && (
          <div className="px-4 pb-4 text-sm text-slate-600 space-y-2">
            <p>Les insights sont générés automatiquement par des <strong>agents IA</strong> qui analysent vos métriques SEO et identifient opportunités et anomalies.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>📊 Rapports</strong> : analyse périodique globale du trafic et des tendances</li>
              <li><strong>🚦 Trafic</strong> : détection de baisses/anomalies de trafic</li>
              <li><strong>🔍 SEO</strong> : opportunités d&apos;optimisation technique</li>
              <li><strong>📝 Contenu</strong> : recommandations sur le contenu</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">💡 Chaque insight contient un score, des preuves et des actions recommandées. Les insights critiques nécessitent une attention immédiate.</p>
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md font-medium ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Tous
        </button>
        <button
          onClick={() => setFilter('report')}
          className={`px-4 py-2 rounded-md font-medium ${filter === 'report' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          📊 Rapports
        </button>
        <button
          onClick={() => setFilter('traffic')}
          className={`px-4 py-2 rounded-md font-medium ${filter === 'traffic' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          🚦 Trafic
        </button>
        <button
          onClick={() => setFilter('seo')}
          className={`px-4 py-2 rounded-md font-medium ${filter === 'seo' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          🔍 SEO
        </button>
        <button
          onClick={() => setFilter('content')}
          className={`px-4 py-2 rounded-md font-medium ${filter === 'content' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          📝 Contenu
        </button>
      </div>

      {/* Liste des insights */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Chargement des insights...</p>
          </div>
        </div>
      ) : insights.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500 text-lg">Aucun insight disponible</p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} showSite={true} />
          ))}
        </div>
      )}
    </div>
  )
}

