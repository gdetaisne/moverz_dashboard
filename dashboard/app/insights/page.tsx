'use client'

import { useEffect, useState } from 'react'
import PageIntro from '@/components/PageIntro'
import { InsightCard } from '@/components/InsightCard'

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

