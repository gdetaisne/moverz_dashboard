'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, MousePointerClick, Eye, Target, RefreshCw } from 'lucide-react'
import { MetricCard } from '@/components/MetricCard'
import { TimeSeriesChart } from '@/components/TimeSeriesChart'
import { DataTable } from '@/components/DataTable'
import { PeriodSelector } from '@/components/PeriodSelector'
import { formatNumber, formatPercent, formatPosition } from '@/lib/utils'
import type { SiteMetrics, GSCGlobalMetrics } from '@/lib/bigquery'

export default function HomePage() {
  const [period, setPeriod] = useState(7)
  const [loading, setLoading] = useState(true)
  const [etlLoading, setEtlLoading] = useState(false)
  const [globalData, setGlobalData] = useState<SiteMetrics[]>([])
  const [timeseriesData, setTimeseriesData] = useState<GSCGlobalMetrics[]>([])
  
  useEffect(() => {
    fetchData()
  }, [period])
  
  async function fetchData() {
    setLoading(true)
    try {
      const [globalRes, timeseriesRes] = await Promise.all([
        fetch(`/api/metrics/global?days=${period}`),
        fetch(`/api/metrics/timeseries?days=30`),
      ])
      
      const globalJson = await globalRes.json()
      const timeseriesJson = await timeseriesRes.json()
      
      if (globalJson.success) setGlobalData(globalJson.data)
      if (timeseriesJson.success) setTimeseriesData(timeseriesJson.data)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  async function runETL() {
    if (etlLoading) return
    
    setEtlLoading(true)
    try {
      const response = await fetch('/api/etl/run', {
        method: 'POST',
      })
      
      const result = await response.json()
      
      if (result.success) {
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
  
  // Calculate totals
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
          <h1 className="text-4xl font-bold text-slate-900">Vue Globale</h1>
          <p className="mt-2 text-lg text-slate-600">Performance SEO des 11 sites Moverz</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={runETL}
            disabled={etlLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
          >
            <RefreshCw className={`h-4 w-4 ${etlLoading ? 'animate-spin' : ''}`} />
            {etlLoading ? 'Actualisation...' : 'Actualiser les données'}
          </button>
          
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>
      
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
      
      {/* Sites Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">🌐 Performance par Site</h2>
        </div>
        <DataTable
          data={globalData}
          columns={[
            { key: 'site', label: 'Site', format: 'text' },
            { key: 'impressions', label: 'Impressions', format: 'number' },
            { key: 'clicks', label: 'Clics', format: 'number' },
            { key: 'ctr', label: 'CTR', format: 'percent' },
            { key: 'position', label: 'Position', format: 'position' },
            { key: 'trend_impressions', label: 'Tendance', format: 'number' },
          ]}
        />
      </div>
    </div>
  )
}

