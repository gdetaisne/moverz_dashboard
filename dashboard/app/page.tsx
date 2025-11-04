'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, MousePointerClick, Eye, Target, RefreshCw, Info, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { MetricCard } from '@/components/MetricCard'
import { TimeSeriesChart } from '@/components/TimeSeriesChart'
import MultiSiteTimeSeriesChart from '@/components/MultiSiteTimeSeriesChart'
import { GroupedDataTable } from '@/components/GroupedDataTable'
import { PeriodSelector } from '@/components/PeriodSelector'
import { InsightCard } from '@/components/InsightCard'
import ChatBot from '@/components/ChatBot'
import PageIntro from '@/components/PageIntro'
import { formatNumber, formatPercent, formatPosition } from '@/lib/utils'
import type { SiteMetrics, GSCGlobalMetrics } from '@/lib/bigquery'

interface GlobalInsight {
  id?: string
  run_date?: string
  site: string
  agent: string
  severity: 'info' | 'warn' | 'critical'
  title: string
  summary: string
  score?: number
  created_at: string
  payload?: any
  evidence?: any
  suggested_actions?: any[]
}

export default function HomePage() {
  const [period, setPeriod] = useState(7)
  const [loading, setLoading] = useState(true)
  const [etlLoading, setEtlLoading] = useState(false)
  const [globalData, setGlobalData] = useState<SiteMetrics[]>([])
  const [timeseriesData, setTimeseriesData] = useState<GSCGlobalMetrics[]>([])
  const [globalInsight, setGlobalInsight] = useState<GlobalInsight | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [showFullImpr, setShowFullImpr] = useState(false)
  const [showFullClicks, setShowFullClicks] = useState(false)
  const [lastUpdateDate, setLastUpdateDate] = useState<Date | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [gscIssuesStats, setGscIssuesStats] = useState<{ total: number; warnings: number; errors: number } | null>(null)
  const [last404ScanDate, setLast404ScanDate] = useState<Date | null>(null)
  
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Timeout soft en dev pour éviter un chargement infini si une route API est lente/non dispo
      const fetchJsonWithTimeout = async (url: string, timeoutMs = 8000) => {
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), timeoutMs)
          const res = await fetch(url, { signal: controller.signal })
          clearTimeout(timer)
          return await res.json().catch(() => null)
        } catch {
          return null
        }
      }

      const [globalJson, timeseriesJson, insightJson, gscIssuesJson, last404Json] = await Promise.all([
        fetchJsonWithTimeout(`/api/metrics/global?days=${period}`),
        fetchJsonWithTimeout(`/api/metrics/timeseries?days=30`),
        fetchJsonWithTimeout(`/api/insights?site=${encodeURIComponent('*global*')}&agent=report`),
        fetchJsonWithTimeout(`/api/gsc/issues?days=7&status=open`),
        fetchJsonWithTimeout(`/api/404/history?mode=last&count=1`),
      ])
      
      if (globalJson.success) setGlobalData(globalJson.data)
      if (timeseriesJson.success) setTimeseriesData(timeseriesJson.data)
      if (insightJson.insights && insightJson.insights.length > 0) {
        setGlobalInsight(insightJson.insights[0])
      }
      if (gscIssuesJson.success && gscIssuesJson.stats) {
        setGscIssuesStats({
          total: gscIssuesJson.stats.total || 0,
          warnings: gscIssuesJson.stats.by_severity?.warning || 0,
          errors: gscIssuesJson.stats.by_severity?.error || 0,
        })
      }
      // Dernier crawl 404
      if (last404Json && last404Json.data && last404Json.data.lastScan) {
        const raw = last404Json.data.lastScan.scan_date
        const dateStr = typeof raw === 'string' ? raw : (raw?.value || raw)
        const d = dateStr ? new Date(dateStr) : null
        if (d && !isNaN(d.getTime())) setLast404ScanDate(d)
      } else {
        setLast404ScanDate(null)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }, [period])
  
  useEffect(() => {
    fetchData()
  }, [fetchData])
  
  async function runETL() {
    if (etlLoading) return
    
    setEtlLoading(true)
    try {
      const response = await fetch('/api/etl/run', {
        method: 'POST',
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Mettre à jour la date du dernier update
        setLastUpdateDate(new Date())
        alert('✅ Données actualisées avec succès !')
        // Recharger les données après l'ETL
        await fetchData()
      } else {
        alert('❌ Erreur lors de l\'actualisation : ' + result.message)
      }
    } catch (error) {
      console.error('Failed to run ETL:', error)
      alert('❌ Erreur lors de l\'actualisation des données')
    } finally {
      setEtlLoading(false)
    }
  }
  
  // Sites avec linking
  // Normalisation: comparer sans préfixe "www." pour éviter les mismatches visuels/données
  const normalizeDomain = (domain: string) => domain.replace(/^www\./, '')
  const sitesWithLinking = [
    'devis-demenageur-strasbourg.fr',
    'bordeaux-demenageur.fr', // sans www (normalisé)
    'devis-demenageur-montpellier.fr',
    'devis-demenageur-nantes.fr',
    'devis-demenageur-rennes.fr',
  ]
  const normalizedWithLinking = sitesWithLinking.map(normalizeDomain)
  
  // Enrichir les données avec la catégorie linking
  const enrichedData = globalData.map(site => {
    const siteDomainNormalized = normalizeDomain(site.site)
    const hasLinking = normalizedWithLinking.includes(siteDomainNormalized)
    return {
      ...site,
      hasLinking,
      linkingLabel: hasLinking ? '✅ Oui' : '❌ Non'
    }
  })
  
  // Séparer et trier
  const withLinking = enrichedData.filter(s => s.hasLinking).sort((a, b) => b.impressions - a.impressions)
  const withoutLinking = enrichedData.filter(s => !s.hasLinking).sort((a, b) => b.impressions - a.impressions)
  
  // Calculer les sous-totaux
  const calcSubtotal = (sites: typeof enrichedData) => {
    const sum = sites.reduce((acc, site) => ({
      clicks: acc.clicks + site.clicks,
      impressions: acc.impressions + site.impressions,
      ctr: acc.ctr + site.ctr,
      position: acc.position + site.position,
    }), { clicks: 0, impressions: 0, ctr: 0, position: 0 })
    
    return {
      site: '',
      clicks: sum.clicks,
      impressions: sum.impressions,
      ctr: sites.length > 0 ? sum.ctr / sites.length : 0,
      position: sites.length > 0 ? sum.position / sites.length : 0,
      trend_clicks: 0,
      trend_impressions: 0,
    }
  }
  
  const subtotalWithLinking = calcSubtotal(withLinking)
  const subtotalWithoutLinking = calcSubtotal(withoutLinking)
  
  // Calculate totals (pour les KPI cards)
  const totals = globalData.reduce((acc, site) => ({
    clicks: acc.clicks + site.clicks,
    impressions: acc.impressions + site.impressions,
    ctr: acc.ctr + site.ctr,
    position: acc.position + site.position,
    trend_clicks: acc.trend_clicks + site.trend_clicks,
    trend_impressions: acc.trend_impressions + site.trend_impressions,
  }), { clicks: 0, impressions: 0, ctr: 0, position: 0, trend_clicks: 0, trend_impressions: 0 })
  
  const avgCtr = globalData.length > 0 ? totals.ctr / globalData.length : 0
  const avgPosition = globalData.length > 0 ? totals.position / globalData.length : 0
  const avgTrendClicks = globalData.length > 0 ? totals.trend_clicks / globalData.length : 0
  const avgTrendImpressions = globalData.length > 0 ? totals.trend_impressions / globalData.length : 0
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
          <p className="mt-4 text-slate-600 font-medium">Chargement des données...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Trafic SEO</h1>
          <PageIntro
            finalite="Suivre l'état global du trafic SEO et les tendances récentes."
            tableaux={['KPI (impressions, clics, CTR, position)', 'Évolution des impressions et des clics', 'Comparatif sites avec/sans linking']}
            sources={["Google Search Console (agrégées quotidiennes)", 'Calculs locaux côté app']}
          />
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <button
              onClick={runETL}
              disabled={etlLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
            >
              <RefreshCw className={`h-4 w-4 ${etlLoading ? 'animate-spin' : ''}`} />
              {etlLoading ? 'Actualisation...' : 'Refresh'}
            </button>
            
            <PeriodSelector value={period} onChange={setPeriod} />
          </div>
          
          {lastUpdateDate && (
            <p className="text-sm text-slate-500">
              Dernier update : {lastUpdateDate.toLocaleString('fr-FR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          )}
        </div>
      </div>
      
      {/* Avertissement si le crawl 404 est ancien (> 7 jours) */}
      {(!last404ScanDate || (Date.now() - last404ScanDate.getTime()) > 7 * 24 * 60 * 60 * 1000) && (
        <div className="rounded-lg border-2 p-4 bg-amber-50 border-amber-300 mb-2">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
            <div className="flex-1">
              <div className="font-semibold text-slate-900 mb-1">
                Le crawl des erreurs 404 n'a pas été exécuté depuis plus de 7 jours
              </div>
              <div className="text-sm text-slate-700">
                {last404ScanDate ? `Dernier crawl: ${last404ScanDate.toLocaleString('fr-FR')}` : `Aucun crawl trouvé`}
              </div>
            </div>
            <a
              href="/404"
              className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Lancer un scan →
            </a>
          </div>
        </div>
      )}
      
      {/* Section Explication */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-100 transition-colors rounded-lg text-sm"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-500" />
            <span className="text-slate-600 font-medium">Comment ces métriques sont calculées ?</span>
          </div>
          {showExplanation ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>
        {showExplanation && (
          <div className="px-4 pb-4 text-sm text-slate-600 space-y-2">
            <p>Les données proviennent de <strong>Google Search Console</strong> via un ETL quotidien qui agrège les métriques par jour.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Impressions</strong> : nombre de fois où votre site apparaît dans les résultats de recherche</li>
              <li><strong>Clics</strong> : nombre d&apos;utilisateurs ayant cliqué sur vos résultats</li>
              <li><strong>CTR</strong> : taux de clic = (Clics / Impressions) × 100</li>
              <li><strong>Position</strong> : position moyenne dans les résultats de recherche</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">💡 Utilisez &quot;Refresh&quot; pour actualiser les données depuis BigQuery. Les tendances compareront la période sélectionnée avec la précédente.</p>
          </div>
        )}
      </div>
      
      {/* Alertes GSC */}
      {gscIssuesStats && gscIssuesStats.total > 0 && (
        <div className={`mb-6 rounded-lg border-2 p-4 ${
          gscIssuesStats.errors > 0 
            ? 'bg-red-50 border-red-300' 
            : gscIssuesStats.warnings > 0 
            ? 'bg-orange-50 border-orange-300' 
            : 'bg-blue-50 border-blue-300'
        }`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={`h-6 w-6 flex-shrink-0 ${
              gscIssuesStats.errors > 0 
                ? 'text-red-600' 
                : gscIssuesStats.warnings > 0 
                ? 'text-orange-600' 
                : 'text-blue-600'
            }`} />
            <div className="flex-1">
              <div className="font-semibold text-gray-900 mb-1">
                {gscIssuesStats.errors > 0 && `${gscIssuesStats.errors} erreur${gscIssuesStats.errors > 1 ? 's' : ''} d'indexation`}
                {gscIssuesStats.errors > 0 && gscIssuesStats.warnings > 0 && ' et '}
                {gscIssuesStats.warnings > 0 && `${gscIssuesStats.warnings} avertissement${gscIssuesStats.warnings > 1 ? 's' : ''}`}
                {gscIssuesStats.total > 0 && ` détecté${gscIssuesStats.total > 1 ? 's' : ''}`}
              </div>
              <div className="text-sm text-gray-600">
                {gscIssuesStats.total} problème{gscIssuesStats.total > 1 ? 's' : ''} d'indexation ouvert{gscIssuesStats.total > 1 ? 's' : ''} sur les 7 derniers jours
              </div>
            </div>
            <a
              href="/gsc-issues"
              className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              Voir les détails →
            </a>
          </div>
        </div>
      )}

      {/* Insight Global */}
      {globalInsight && (
        <div className="mb-6">
          <InsightCard insight={globalInsight} showSite={false} />
        </div>
      )}
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Impressions Totales"
          value={formatNumber(totals.impressions)}
          trend={avgTrendImpressions}
          icon={<Eye className="h-5 w-5 text-gray-400" />}
        />
        <MetricCard
          title="Clics Totaux"
          value={formatNumber(totals.clicks)}
          trend={avgTrendClicks}
          icon={<MousePointerClick className="h-5 w-5 text-gray-400" />}
        />
        <MetricCard
          title="CTR Moyen"
          value={formatPercent(avgCtr)}
          icon={<TrendingUp className="h-5 w-5 text-gray-400" />}
        />
        <MetricCard
          title="Position Moyenne"
          value={formatPosition(avgPosition)}
          format="position"
          icon={<Target className="h-5 w-5 text-gray-400" />}
        />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4">📊 Évolution des Impressions</h2>
          <TimeSeriesChart data={timeseriesData} metric="impressions" />
        </div>
        
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4">👆 Évolution des Clics</h2>
          <TimeSeriesChart data={timeseriesData} metric="clicks" />
        </div>
      </div>

      {/* Charts par site */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">📊 Évolution des Impressions par site</h2>
            <button
              onClick={() => setShowFullImpr(true)}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-50 text-slate-700"
            >
              Plein écran
            </button>
          </div>
          <MultiSiteTimeSeriesChart data={timeseriesData as any} metric="impressions" />
        </div>
        
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">👆 Évolution des Clics par site</h2>
            <button
              onClick={() => setShowFullClicks(true)}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-50 text-slate-700"
            >
              Plein écran
            </button>
          </div>
          <MultiSiteTimeSeriesChart data={timeseriesData as any} metric="clicks" />
        </div>
      </div>

      {/* Modal plein écran - Impressions */}
      {showFullImpr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white w-[95vw] h-[95vh] rounded-lg shadow-xl border border-slate-200 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-slate-900">📊 Évolution des Impressions par site</h3>
              <button
                onClick={() => setShowFullImpr(false)}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-50 text-slate-700"
                aria-label="Fermer"
              >
                Fermer
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <MultiSiteTimeSeriesChart data={timeseriesData as any} metric="impressions" height="100%" />
            </div>
          </div>
        </div>
      )}

      {/* Modal plein écran - Clics */}
      {showFullClicks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white w-[95vw] h-[95vh] rounded-lg shadow-xl border border-slate-200 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-slate-900">👆 Évolution des Clics par site</h3>
              <button
                onClick={() => setShowFullClicks(false)}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-50 text-slate-700"
                aria-label="Fermer"
              >
                Fermer
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <MultiSiteTimeSeriesChart data={timeseriesData as any} metric="clicks" height="100%" />
            </div>
          </div>
        </div>
      )}
      
      {/* Sites Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">🌐 Performance par Site (Avec/Sans Linking)</h2>
          <p className="text-sm text-slate-600 mt-1">
            Comparaison des performances entre sites avec et sans stratégie de linking
          </p>
        </div>
        <GroupedDataTable
          withLinking={withLinking}
          withoutLinking={withoutLinking}
          subtotalWithLinking={subtotalWithLinking}
          subtotalWithoutLinking={subtotalWithoutLinking}
          grandTotal={{
            site: 'TOTAL',
            clicks: totals.clicks,
            impressions: totals.impressions,
            ctr: avgCtr,
            position: avgPosition,
            trend_clicks: 0,
            trend_impressions: 0,
          }}
        />
      </div>

      {/* ChatBot flottant */}
      <ChatBot isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
    </div>
  )
}

