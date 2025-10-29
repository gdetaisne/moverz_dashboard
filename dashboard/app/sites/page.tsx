'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { MetricCard } from '@/components/MetricCard'
import { DataTable } from '@/components/DataTable'
import { CITIES } from '@/lib/utils'
import { formatNumber, formatPercent, formatPosition } from '@/lib/utils'
import type { SiteMetrics, GSCPageMetrics, GSCQueryMetrics } from '@/lib/bigquery'

export default function SitesPage() {
  const [loading, setLoading] = useState(true)
  const [globalData, setGlobalData] = useState<SiteMetrics[]>([])
  const [selectedSite, setSelectedSite] = useState<string | null>(null)
  const [pagesData, setPagesData] = useState<GSCPageMetrics[]>([])
  const [queriesData, setQueriesData] = useState<GSCQueryMetrics[]>([])
  
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const globalRes = await fetch(`/api/metrics/global?days=7`)
        const globalJson = await globalRes.json()
        
        if (globalJson.success) {
          setGlobalData(globalJson.data)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])
  
  useEffect(() => {
    if (!selectedSite) return
    
    async function fetchSiteDetails() {
      try {
        const [pagesRes, queriesRes] = await Promise.all([
          fetch(`/api/metrics/pages?site=${selectedSite}&limit=10`),
          fetch(`/api/metrics/queries?site=${selectedSite}&limit=10`),
        ])
        
        const pagesJson = await pagesRes.json()
        const queriesJson = await queriesRes.json()
        
        if (pagesJson.success) setPagesData(pagesJson.data)
        if (queriesJson.success) setQueriesData(queriesJson.data)
      } catch (error) {
        console.error('Failed to fetch site details:', error)
      }
    }
    
    fetchSiteDetails()
  }, [selectedSite])
  
  const selectedSiteData = globalData.find(s => s.site === selectedSite)
  const cityInfo = CITIES.find(c => c.domain === selectedSite)
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Analyse par Site</h1>
        <p className="mt-1 text-gray-600">Détails SEO pour chaque ville</p>
      </div>
      
      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {globalData.map((site) => {
          const city = CITIES.find(c => c.domain === site.site)
          const isSelected = selectedSite === site.site
          
          return (
            <button
              key={site.site}
              onClick={() => setSelectedSite(site.site)}
              className={`text-left p-6 rounded-lg border-2 transition-all ${
                isSelected 
                  ? 'border-primary-500 bg-primary-50 shadow-lg' 
                  : 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">{city?.name || site.site}</h3>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </div>
              
              <div className="space-y-1 text-sm">
                <p className="text-gray-600">
                  <span className="font-medium">{formatNumber(site.impressions)}</span> impressions
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">{formatNumber(site.clicks)}</span> clics
                </p>
                <p className="text-gray-600">
                  CTR: <span className="font-medium">{formatPercent(site.ctr)}</span>
                </p>
              </div>
            </button>
          )
        })}
      </div>
      
      {/* Site Details */}
      {selectedSite && selectedSiteData && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{cityInfo?.name}</h2>
            <a
              href={`https://${selectedSite}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 flex items-center gap-2"
            >
              Visiter le site
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              title="Impressions"
              value={formatNumber(selectedSiteData.impressions)}
              trend={selectedSiteData.trend_impressions}
            />
            <MetricCard
              title="Clics"
              value={formatNumber(selectedSiteData.clicks)}
              trend={selectedSiteData.trend_clicks}
            />
            <MetricCard
              title="CTR"
              value={formatPercent(selectedSiteData.ctr)}
            />
            <MetricCard
              title="Position"
              value={formatPosition(selectedSiteData.position)}
              format="position"
            />
          </div>
          
          {/* Top Pages */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Top 10 Pages</h3>
            </div>
            <DataTable
              data={pagesData}
              columns={[
                { key: 'page', label: 'URL', format: 'text' },
                { key: 'impressions', label: 'Impressions', format: 'number' },
                { key: 'clicks', label: 'Clics', format: 'number' },
                { key: 'ctr', label: 'CTR', format: 'percent' },
                { key: 'position', label: 'Position', format: 'position' },
              ]}
            />
          </div>
          
          {/* Top Queries */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Top 10 Requêtes</h3>
            </div>
            <DataTable
              data={queriesData}
              columns={[
                { key: 'query', label: 'Requête', format: 'text' },
                { key: 'impressions', label: 'Impressions', format: 'number' },
                { key: 'clicks', label: 'Clics', format: 'number' },
                { key: 'ctr', label: 'CTR', format: 'percent' },
                { key: 'position', label: 'Position', format: 'position' },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  )
}

