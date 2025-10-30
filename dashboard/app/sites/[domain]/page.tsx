'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, TrendingDown, ExternalLink, FileText, Search, Sparkles } from 'lucide-react'
import { InsightCard } from '@/components/InsightCard'

const SITES = [
  'devis-demenageur-marseille.fr',
  'devis-demenageur-toulousain.fr',
  'devis-demenageur-lyon.fr',
  'bordeaux-demenageur.fr',
  'devis-demenageur-nantes.fr',
  'devis-demenageur-lille.fr',
  'devis-demenageur-nice.fr',
  'devis-demenageur-strasbourg.fr',
  'devis-demenageur-rouen.fr',
  'devis-demenageur-rennes.fr',
  'devis-demenageur-montpellier.fr',
]

interface SiteData {
  summary: {
    total_impressions: number
    total_clicks: number
    avg_ctr: number
    avg_position: number
    variation_7d?: number
  }
  timeseries: Array<{
    date: string
    impressions: number
    clicks: number
    ctr: number
    position: number
  }>
  top_pages: Array<{
    url: string
    impressions: number
    clicks: number
    ctr: number
    position: number
  }>
  top_queries: Array<{
    query: string
    impressions: number
    clicks: number
    ctr: number
    position: number
  }>
  insights: Array<{
    title: string
    summary: string
    severity: string
    created_at: string
  }>
}

export default function SitePage() {
  const params = useParams()
  const domain = params.domain as string
  const [data, setData] = useState<SiteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    fetchData()
  }, [domain, period])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sites/${domain}?days=${period}`)
      const json = await res.json()
      setData(json)
    } catch (error) {
      console.error('Error fetching site data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(Math.round(num))
  }

  const formatPercent = (num: number) => {
    return (num * 100).toFixed(2) + '%'
  }

  const getCityName = (domain: string) => {
    const match = domain.match(/demenageur-(.+?)\.fr/)
    if (match) {
      const city = match[1].replace('toulousain', 'toulouse')
      return city.charAt(0).toUpperCase() + city.slice(1)
    }
    if (domain.includes('bordeaux')) return 'Bordeaux'
    return domain
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sous-navigation des sites */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-2 scrollbar-thin">
            {SITES.map((site) => (
              <Link
                key={site}
                href={`/sites/${site}`}
                className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition ${
                  site === domain
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {getCityName(site)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{getCityName(domain)}</h1>
            <a
              href={`https://${domain.replace('www.', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
            >
              {domain} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          
          {/* Sélecteur de période */}
          <div className="flex gap-2">
            {['7', '30', '90'].map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                className={`px-4 py-2 rounded-md font-medium ${
                  period === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border hover:bg-gray-50'
                }`}
              >
                {days} jours
              </button>
            ))}
          </div>
        </div>

        {!data ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <p className="text-gray-500">Aucune donnée disponible</p>
          </div>
        ) : (
          <>
            {/* Métriques globales */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <MetricCard
                title="Impressions"
                value={formatNumber(data.summary.total_impressions)}
                variation={data.summary.variation_7d}
                icon="👁️"
              />
              <MetricCard
                title="Clics"
                value={formatNumber(data.summary.total_clicks)}
                icon="🖱️"
              />
              <MetricCard
                title="CTR Moyen"
                value={formatPercent(data.summary.avg_ctr)}
                icon="📊"
              />
              <MetricCard
                title="Position Moyenne"
                value={data.summary.avg_position.toFixed(1)}
                icon="📍"
              />
            </div>

            {/* Évolution temporelle */}
            {data.timeseries && data.timeseries.length > 0 && (
              <div className="bg-white rounded-lg border p-6 mb-8">
                <h2 className="text-xl font-bold mb-4">📈 Évolution</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {data.timeseries.slice(0, 30).map((day, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm border-b pb-2">
                      <span className="text-gray-600 w-24">{new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                      <span className="w-20 text-right">{formatNumber(day.impressions)} imp.</span>
                      <span className="w-16 text-right font-medium text-blue-600">{formatNumber(day.clicks)} clics</span>
                      <span className="w-16 text-right text-gray-500">{formatPercent(day.ctr)}</span>
                      <span className="w-16 text-right text-gray-500">pos. {day.position.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Pages */}
              <div className="bg-white rounded-lg border p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Top Pages ({data.top_pages?.length || 0})
                </h2>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {data.top_pages?.slice(0, 20).map((page, idx) => (
                    <div key={idx} className="border-b pb-3">
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-start gap-1 mb-1"
                      >
                        <span className="truncate">{page.url.replace(`https://${domain.replace('www.', '')}`, '')}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      </a>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>{formatNumber(page.impressions)} imp.</span>
                        <span className="font-medium text-blue-600">{formatNumber(page.clicks)} clics</span>
                        <span>CTR: {formatPercent(page.ctr)}</span>
                        <span>Pos: {page.position.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Queries */}
              <div className="bg-white rounded-lg border p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Top Requêtes ({data.top_queries?.length || 0})
                </h2>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {data.top_queries?.slice(0, 50).map((query, idx) => (
                    <div key={idx} className="border-b pb-3">
                      <div className="text-sm font-medium mb-1">{query.query}</div>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>{formatNumber(query.impressions)} imp.</span>
                        <span className="font-medium text-blue-600">{formatNumber(query.clicks)} clics</span>
                        <span>CTR: {formatPercent(query.ctr)}</span>
                        <span>Pos: {query.position.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Insights IA */}
            {data.insights && data.insights.length > 0 && (
              <div className="mt-8">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-blue-600" />
                  Insights IA pour {getCityName(domain)}
                </h2>
                <p className="text-gray-600 mb-4">
                  Analyses et recommandations générées par les agents IA pour ce site.
                </p>
                <div className="space-y-4">
                  {data.insights.map((insight, idx) => (
                    <InsightCard 
                      key={idx} 
                      insight={{
                        ...insight,
                        id: `${domain}-${idx}`,
                        run_date: new Date(insight.created_at).toISOString().split('T')[0]
                      }} 
                      showSite={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function MetricCard({ title, value, variation, icon }: { title: string; value: string; variation?: number | null; icon: string }) {
  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm text-gray-600">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
      {variation !== undefined && variation !== null && !isNaN(variation) && (
        <div className={`flex items-center gap-1 text-sm mt-2 ${variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {variation >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span>{variation >= 0 ? '+' : ''}{variation.toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
}

