'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Search, RefreshCw, ExternalLink, Loader2, Download } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { Error404Evolution } from '@/components/Error404Evolution'
import { Error404Analysis } from '@/components/Error404Analysis'

interface ScanResult {
  site: string
  total_checked: number
  errors_404: number
  broken_links: number
  errors_list: string[]
  broken_links_list?: Array<{ source: string; target: string }>
  scan_date?: string
  progress_percent?: number
  status?: 'in_progress' | 'completed'
}

export default function NotFoundPage() {
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState<ScanResult[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showBrokenLinksTable, setShowBrokenLinksTable] = useState(false)
  
  async function runScan() {
    if (scanning) return
    
    setScanning(true)
    setResults([])
    setSummary(null)
    
    try {
      const response = await fetch('/api/404/crawl', {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      if (!reader) {
        throw new Error('No response body')
      }
      
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (!line.trim()) continue
          
          const eventMatch = line.match(/^event: (.+)\ndata: (.+)$/s)
          if (!eventMatch) continue
          
          const [, eventType, dataStr] = eventMatch
          const data = JSON.parse(dataStr)
          
          if (eventType === 'init') {
            // Initialize results array with empty entries
            const initialResults = data.sites.map((site: string) => ({
              site,
              total_checked: 0,
              errors_404: 0,
              errors_list: [],
              progress_percent: 0,
              status: 'in_progress' as const,
            }))
            setResults(initialResults)
          } else if (eventType === 'progress') {
            // Update specific site result
            setResults(prev => {
              const index = prev.findIndex(r => r.site === data.site)
              if (index === -1) return prev
              
              const updated = [...prev]
              updated[index] = {
                ...updated[index],
                total_checked: data.total_checked || 0,
              errors_404: data.errors_404 || 0,
              broken_links: data.broken_links || 0,
              errors_list: data.errors_list || [],
              broken_links_list: data.broken_links_list || [],
              progress_percent: data.progress_percent || 0,
              status: data.status || 'in_progress',
              }
              return updated
            })
          } else if (eventType === 'complete') {
            setSummary(data.summary)
            setLastScan(data.timestamp)
          } else if (eventType === 'error') {
            console.error('Crawl error:', data)
            alert('❌ Erreur lors du crawl : ' + data.message)
          }
        }
      }
      
    } catch (error) {
      console.error('Failed to run crawl:', error)
      alert('❌ Erreur lors du crawl des 404')
    } finally {
      setScanning(false)
    }
  }
  
  // Charger l'historique au montage
  useEffect(() => {
    loadHistory()
  }, [])
  
  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const response = await fetch('/api/404/history?days=30')
      const data = await response.json()
      if (data.success && data.data.evolution) {
        setHistoryData(data.data.evolution)
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }
  
  // Format time ago
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const scanDate = new Date(timestamp)
    const diffMs = now.getTime() - scanDate.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'à l\'instant'
    if (diffMins < 60) return `il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`
    if (diffHours < 24) return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`
    return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`
  }
  
  const totalErrors = results.reduce((sum, r) => sum + r.errors_404, 0)
  
  // Export CSV des liens cassés
  function exportBrokenLinksToCSV() {
    // Collecter tous les liens cassés
    const allLinks = results
      .filter(r => r.broken_links_list && r.broken_links_list.length > 0)
      .flatMap(result =>
        result.broken_links_list!.map(link => ({
          site: result.site,
          page_source: link.source,
          lien_casse: link.target,
        }))
      )
    
    if (allLinks.length === 0) {
      alert('Aucun lien cassé à exporter')
      return
    }
    
    // Créer le CSV
    const headers = ['Site', 'Page Source', 'Lien Cassé']
    const csvContent = [
      headers.join(','),
      ...allLinks.map(link => [
        link.site,
        `"${link.page_source}"`,
        `"${link.lien_casse}"`
      ].join(','))
    ].join('\n')
    
    // Créer le blob et télécharger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `liens-casses-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-10 w-10 text-orange-600" />
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Erreurs 404</h1>
            <p className="mt-2 text-lg text-slate-600">Crawler récursif de pages introuvables (tous les liens internes)</p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={runScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
          >
            {scanning ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Crawl en cours...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Analyser les 404
              </>
            )}
          </button>
          
          {lastScan && (
            <p className="text-sm text-slate-500">
              Dernier scan : <span className="font-semibold text-slate-700">{formatTimeAgo(lastScan)}</span>
            </p>
          )}
        </div>
      </div>
      
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Sites Analysés</p>
            <p className="text-4xl font-bold text-slate-900 mt-2">{summary.total_sites}</p>
          </div>
          
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Pages Vérifiées</p>
            <p className="text-4xl font-bold text-slate-900 mt-2">{formatNumber(summary.total_checked)}</p>
          </div>
          
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Erreurs 404</p>
            <p className="text-4xl font-bold text-orange-600 mt-2">{summary.total_errors}</p>
          </div>
        </div>
      )}
      
      {/* Results Table */}
      {results.length > 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">📋 Résultats du Scan</h2>
              {lastScan && (
                <p className="text-sm text-slate-600">
                  Dernier scan : {new Date(lastScan).toLocaleString('fr-FR')}
                </p>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Site
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    % Pages Revues
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Pages Vérifiées
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Erreurs 404
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Liens Cassés
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Taux d&apos;Erreur
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {results
                  .sort((a, b) => b.errors_404 - a.errors_404)
                  .map((result) => {
                    const errorRate = result.total_checked > 0 
                      ? (result.errors_404 / result.total_checked * 100).toFixed(1) 
                      : '0.0'
                    
                    const isInProgress = result.status === 'in_progress'
                    const progress = result.progress_percent || 0
                    
                    return (
                      <tr key={result.site} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          <a 
                            href={`https://${result.site}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
                          >
                            {result.site}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-slate-200 rounded-full h-2 w-24">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  progress === 100 ? 'bg-green-600' : 'bg-orange-500'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className={`font-semibold text-xs ${
                              progress === 100 ? 'text-green-600' : 'text-slate-700'
                            }`}>
                              {progress}%
                            </span>
                            {isInProgress && progress < 100 && (
                              <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {result.total_checked}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold">
                          <span className={result.errors_404 > 0 ? 'text-orange-600' : 'text-green-600'}>
                            {result.errors_404}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold">
                          <span className={result.broken_links > 0 ? 'text-red-600' : 'text-green-600'}>
                            {result.broken_links || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {errorRate}%
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
              
              {/* Total Row */}
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr className="font-bold">
                  <td className="px-6 py-4 text-sm text-slate-900">
                    TOTAL ({results.length} sites)
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {/* Vide pour % Pages Revues */}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">
                    {results.reduce((sum, r) => sum + r.total_checked, 0)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-orange-600 text-lg font-bold">
                      {results.reduce((sum, r) => sum + r.errors_404, 0)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-red-600 text-lg font-bold">
                      {results.reduce((sum, r) => sum + (r.broken_links || 0), 0)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900">
                    {(() => {
                      const totalChecked = results.reduce((sum, r) => sum + r.total_checked, 0)
                      const totalErrors = results.reduce((sum, r) => sum + r.errors_404, 0)
                      return totalChecked > 0 
                        ? ((totalErrors / totalChecked) * 100).toFixed(1) + '%'
                        : '0.0%'
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 p-12 shadow-sm text-center">
          <AlertTriangle className="h-16 w-16 text-orange-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Aucun crawl effectué</h2>
          <p className="text-slate-600 mb-6">
            Cliquez sur &quot;Analyser les 404&quot; pour lancer un crawl récursif des 11 sites.
          </p>
          <div className="bg-slate-50 rounded-lg p-6 max-w-2xl mx-auto text-left">
            <h3 className="font-semibold text-slate-900 mb-3">🕷️ Fonctionnement du crawler :</h3>
            <ul className="space-y-2 text-slate-700 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold">1.</span>
                <span>Commence à la page d&apos;accueil de chaque site</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold">2.</span>
                <span>Parse tous les liens internes trouvés dans le HTML</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold">3.</span>
                <span>Suit récursivement chaque lien (max 150 pages/site)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold">4.</span>
                <span>Détecte toutes les erreurs 404 rencontrées</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold">⚡</span>
                <span className="font-semibold text-green-600">Crawl parallèle : ~30-60 secondes pour 11 sites !</span>
              </li>
            </ul>
          </div>
        </div>
      )}
      
      {/* Analyse IA (au-dessus des liens cassés) */}
      {results.length > 0 && totalErrors > 0 && (
        <Error404Analysis results={results} />
      )}
      
      {/* Tableau Liens Cassés */}
      {results.length > 0 && results.reduce((sum, r) => sum + (r.broken_links || 0), 0) > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h2 className="text-lg font-bold text-slate-800">🔗 Liens Cassés Détail</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportBrokenLinksToCSV}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all shadow-sm hover:shadow-md"
                >
                  <Download className="h-4 w-4" />
                  Exporter CSV
                </button>
                <button
                  onClick={() => setShowBrokenLinksTable(!showBrokenLinksTable)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-semibold"
                >
                  {showBrokenLinksTable ? 'Masquer' : 'Afficher'} les détails
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              {results.reduce((sum, r) => sum + (r.broken_links_list?.length || 0), 0)} liens cassés détectés
            </p>
          </div>
          
          {showBrokenLinksTable && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Site
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Page Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Lien Cassé
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {results
                    .filter(r => r.broken_links_list && r.broken_links_list.length > 0)
                    .flatMap(result => 
                      result.broken_links_list!.map((link, idx) => (
                        <tr key={`${result.site}-${idx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 text-sm font-medium text-slate-900">
                            {result.site}
                          </td>
                          <td className="px-6 py-3 text-sm">
                            <a 
                              href={link.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-700 flex items-center gap-2"
                            >
                              {new URL(link.source).pathname}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                          <td className="px-6 py-3 text-sm text-red-600 font-medium">
                            <a 
                              href={link.target}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-red-600 hover:text-red-700 flex items-center gap-2"
                            >
                              {new URL(link.target).pathname}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      
      {/* Historique - Section Évolution */}
      <Error404Evolution data={historyData} />
    </div>
  )
}

