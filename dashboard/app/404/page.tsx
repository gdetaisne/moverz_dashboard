'use client'

import { useState, useEffect } from 'react'
import PageIntro from '@/components/PageIntro'
import { AlertTriangle, Search, RefreshCw, ExternalLink, Loader2, Download, TrendingUp, TrendingDown, Minus, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { Error404Evolution } from '@/components/Error404Evolution'
import { Error404Analysis } from '@/components/Error404Analysis'

interface ScanResult {
  site: string
  total_checked: number
  total_pages_found?: number // Nombre total de pages trouvées
  pages_not_analyzed?: number // Pages non analysées (limite atteinte)
  max_pages_per_site?: number // Limite maximale de pages analysées
  errors_404: number
  broken_links: number
  errors_list: string[]
  broken_links_list?: Array<{ source: string; target: string }>
  scan_date?: string
  progress_percent?: number
  status?: 'in_progress' | 'completed'
}

const SITES = [
  'devis-demenageur-marseille.fr',
  'devis-demenageur-strasbourg.fr',
  'devis-demenageur-lille.fr',
  'devis-demenageur-rennes.fr',
  'devis-demenageur-rouen.fr',
  'devis-demenageur-nice.fr',
  'devis-demenageur-nantes.fr',
  'devis-demenageur-toulousain.fr',
  'devis-demenageur-lyon.fr',
  'www.bordeaux-demenageur.fr',
  'devis-demenageur-montpellier.fr',
]

export default function NotFoundPage() {
  const [scanning, setScanning] = useState(false)
  const [selectedSite, setSelectedSite] = useState<string>('all') // 'all' ou un site spécifique
  const [results, setResults] = useState<ScanResult[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showBrokenLinksTable, setShowBrokenLinksTable] = useState(false)
  const [showCrawlerExplanation, setShowCrawlerExplanation] = useState(false)
  const [delta, setDelta] = useState<any | null>(null)
  const [loadingDelta, setLoadingDelta] = useState(false)
  const [loadingLast, setLoadingLast] = useState(false)
  
  async function runScan() {
    if (scanning) return
    
    setScanning(true)
    setResults([])
    setSummary(null)
    
    try {
      const response = await fetch('/dashboard-api/404/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site: selectedSite === 'all' ? null : selectedSite,
        }),
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
                total_pages_found: data.total_pages_found,
                pages_not_analyzed: data.pages_not_analyzed,
                max_pages_per_site: data.max_pages_per_site,
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
    loadDelta()
    loadLastScan()
    const id = setInterval(() => { loadDelta(); loadLastScan() }, 15000)
    return () => clearInterval(id)
  }, [])
  
  async function loadHistory() {
    setLoadingHistory(true)
    try {
      // Mode 'evolution' pour agrégation quotidienne (meilleure visualisation)
      const response = await fetch('/dashboard-api/404/history?days=30&mode=evolution')
      
      if (!response.ok) {
        console.error('[404] History API not OK:', response.status, response.statusText)
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('[404] History API error body:', errorText)
        setHistoryData([])
        return
      }
      
      const data = await response.json()
      
      console.log('[404] History API response:', {
        success: data.success,
        hasData: !!data.data,
        hasEvolution: !!data.data?.evolution,
        evolutionType: Array.isArray(data.data?.evolution) ? 'array' : typeof data.data?.evolution,
        evolutionLength: Array.isArray(data.data?.evolution) ? data.data.evolution.length : 'N/A',
        evolutionSample: Array.isArray(data.data?.evolution) && data.data.evolution.length > 0 ? data.data.evolution[0] : null,
        meta: data.meta,
        error: data.error,
        errorCode: data.errorCode,
      })
      
      // Si erreur, logger et afficher dans la console
      if (!data.success) {
        console.error('[404] History API returned error:', {
          message: data.error,
          code: data.errorCode,
          stack: data.stack,
        })
        // Continuer pour afficher le message "Aucune donnée" mais avec info d'erreur
      }
      
      // Toujours définir historyData, même si c'est un tableau vide
      if (data.success && data.data && Array.isArray(data.data.evolution)) {
        console.log('[404] Setting historyData:', data.data.evolution.length, 'entries')
        setHistoryData(data.data.evolution)
      } else {
        // Si la structure n'est pas celle attendue, initialiser avec un tableau vide
        console.warn('[404] Unexpected API response structure:', data)
        setHistoryData([])
      }
    } catch (error) {
      console.error('[404] Failed to load history:', error)
      setHistoryData([]) // S'assurer qu'on a toujours un tableau
    } finally {
      setLoadingHistory(false)
    }
  }

  async function loadDelta() {
    setLoadingDelta(true)
    try {
      const res = await fetch('/dashboard-api/404/delta')
      const json = await res.json()
      if (json.success) setDelta(json.data)
      else setDelta(null)
    } catch (e) {
      console.warn('Failed to load delta', e)
      setDelta(null)
    } finally {
      setLoadingDelta(false)
    }
  }

  async function loadLastScan() {
    if (scanning) return
    setLoadingLast(true)
    try {
      const res = await fetch('/dashboard-api/404/last')
      if (!res.ok) return
      const json = await res.json()
      if (json.success && json.data && Array.isArray(json.data.results)) {
        setResults(json.data.results)
        setSummary(json.data.summary)
        setLastScan(json.data.scan_date)
      }
    } catch {}
    finally { setLoadingLast(false) }
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
    const headers = ['Site', 'Page Source', 'Lien cassé visible']
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
            <PageIntro
              finalite="Mesurer et réduire les erreurs 404 sur les sites."
              tableaux={["Historique par scan", 'Évolution des erreurs', 'Liens cassés visibles']}
              sources={["Crawler interne enregistré dans BigQuery"]}
            />
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
      
      {/* Section Explication Crawler */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
        <button
          onClick={() => setShowCrawlerExplanation(!showCrawlerExplanation)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-blue-100 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-800">🕷️ Comment fonctionne le crawler ?</h2>
          </div>
          {showCrawlerExplanation ? (
            <ChevronUp className="h-5 w-5 text-blue-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-blue-600" />
          )}
        </button>
        
        {showCrawlerExplanation && (
          <div className="px-6 pb-6 space-y-4">
            <p className="text-slate-700 text-sm">
              Le crawler analyse de manière automatique tous vos sites pour détecter les erreurs 404 et les liens cassés visibles.
            </p>
            
            <div className="bg-white rounded-lg p-5 border border-blue-100">
              <h3 className="font-semibold text-slate-900 mb-3 text-base">Processus de crawl :</h3>
              <ul className="space-y-3 text-slate-700 text-sm">
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold text-base mt-0.5">1.</span>
                  <div>
                    <span className="font-semibold">Démarrage depuis la page d&apos;accueil</span>
                    <p className="text-slate-600 mt-0.5">Le crawler commence par la page d&apos;accueil de chaque site pour établir une carte complète.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold text-base mt-0.5">2.</span>
                  <div>
                    <span className="font-semibold">Parsing des liens internes</span>
                    <p className="text-slate-600 mt-0.5">Analyse du HTML de chaque page pour extraire tous les liens internes (balises &lt;a href=&quot;...&quot;&gt;).</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold text-base mt-0.5">3.</span>
                  <div>
                    <span className="font-semibold">Crawl récursif</span>
                    <p className="text-slate-600 mt-0.5">Suit chaque lien trouvé récursivement pour explorer toutes les pages accessibles (limite : 300 pages par site).</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold text-base mt-0.5">4.</span>
                  <div>
                    <span className="font-semibold">Détection des erreurs</span>
                    <p className="text-slate-600 mt-0.5">Enregistre toutes les URLs qui retournent un code HTTP 404 (page non trouvée).</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold text-base mt-0.5">5.</span>
                  <div>
                    <span className="font-semibold">Liens cassés visibles</span>
                    <p className="text-slate-600 mt-0.5">Détecte les liens pointant vers des pages 404 qui sont visibles dans le contenu HTML (différent des redirections serveur).</p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <h4 className="font-semibold text-slate-900 mb-2 text-sm">⚡ Performance</h4>
                <p className="text-slate-600 text-sm">
                  Crawl parallèle de tous les sites simultanément. Durée typique : <strong className="text-green-600">30-60 secondes</strong> pour analyser 11 sites.
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <h4 className="font-semibold text-slate-900 mb-2 text-sm">💾 Stockage</h4>
                <p className="text-slate-600 text-sm">
                  Tous les résultats sont enregistrés dans <strong>BigQuery</strong> pour permettre l&apos;historique et le suivi dans le temps.
                </p>
              </div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>💡 Astuce :</strong> Le pourcentage &quot;Pages Revues&quot; indique la progression du crawl. Si certaines pages ne sont pas analysées (limite de 300 pages/site atteinte), un avertissement apparaît.
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Delta Bandeau */}
      {delta && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-800">Delta dernier commit</h2>
              {(() => {
                const d = (delta.broken_links || delta.urls_404 || delta)
                return (
                  <span className="text-sm text-slate-500">{d?.from_scan_id?.slice?.(0,8)} → {d?.to_scan_id?.slice?.(0,8)}</span>
                )
              })()}
            </div>
            <button
              onClick={loadDelta}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200"
            >
              <RefreshCw className="h-4 w-4" /> Rafraîchir
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-md border border-slate-200 bg-slate-50">
              <TrendingDown className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-xs uppercase text-slate-600 font-semibold">Corrigées</div>
                <div className="text-2xl font-bold text-green-700">{(delta.broken_links?.lost?.length) ?? (delta.urls_404?.lost?.length) ?? 0}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md border border-slate-200 bg-slate-50">
              <TrendingUp className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-xs uppercase text-slate-600 font-semibold">Nouvelles</div>
                <div className="text-2xl font-bold text-red-700">{(delta.broken_links?.gained?.length) ?? (delta.urls_404?.gained?.length) ?? 0}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md border border-slate-200 bg-slate-50">
              <Minus className="h-5 w-5 text-slate-600" />
              <div>
                <div className="text-xs uppercase text-slate-600 font-semibold">Persistantes</div>
                <div className="text-2xl font-bold text-slate-800">{(delta.broken_links?.persisting) ?? (delta.urls_404?.persisting) ?? 0}</div>
              </div>
            </div>
          </div>
          {(((delta.broken_links?.gained?.length || 0) + (delta.broken_links?.lost?.length || 0)) > 0
            || ((delta.urls_404?.gained?.length || 0) + (delta.urls_404?.lost?.length || 0)) > 0) && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nouvelles */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">Nouvelles (liens cassés visibles ou 404)</div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-bold text-slate-700 uppercase">Site</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-slate-700 uppercase">Path</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(delta.broken_links?.gained || delta.urls_404?.gained || []).map((it: any, idx: number) => (
                        <tr key={`g-${idx}`} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-900">{it.site}</td>
                          <td className="px-4 py-2 text-red-700">{it.path}</td>
                        </tr>
                      ))}
                      {((delta.broken_links?.gained?.length || 0) + (delta.urls_404?.gained?.length || 0) === 0) && (
                        <tr><td className="px-4 py-2 text-slate-500" colSpan={2}>Aucune</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Corrigées */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">Corrigées</div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-bold text-slate-700 uppercase">Site</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-slate-700 uppercase">Path</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(delta.broken_links?.lost || delta.urls_404?.lost || []).map((it: any, idx: number) => (
                        <tr key={`l-${idx}`} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-900">{it.site}</td>
                          <td className="px-4 py-2 text-green-700">{it.path}</td>
                        </tr>
                      ))}
                      {((delta.broken_links?.lost?.length || 0) + (delta.urls_404?.lost?.length || 0) === 0) && (
                        <tr><td className="px-4 py-2 text-slate-500" colSpan={2}>Aucune</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
                    Pages (Analysées / Trouvées)
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Erreurs 404
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Liens cassés visibles
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
                    
                    // Variations (delta) par site
                    const getDeltaForSite = (site: string) => {
                      const dl = delta?.broken_links || delta?.data?.broken_links || delta?.data || null
                      const du = delta?.urls_404 || delta?.data?.urls_404 || null
                      const bl = dl?.by_site?.find((s: any) => s.site === site)
                      const u4 = du?.by_site?.find((s: any) => s.site === site)
                      return { bl, u4 }
                    }
                    const { bl, u4 } = getDeltaForSite(result.site)
                    const net404 = u4 ? (u4.gained - u4.lost) : 0
                    const netBL = bl ? (bl.gained - bl.lost) : 0

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
                          <div className="flex flex-col">
                            <span>
                              {result.total_checked}
                              {result.total_pages_found && result.total_pages_found > result.total_checked && (
                                <span className="text-slate-500"> / {result.total_pages_found}</span>
                              )}
                            </span>
                            {(result.pages_not_analyzed ?? 0) > 0 && result.total_checked >= (result.max_pages_per_site || 300) && (
                              <span className="text-xs text-orange-600 font-semibold mt-1">
                                ⚠️ {result.pages_not_analyzed} non analysées (limite {result.max_pages_per_site || 300})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold">
                          <div className="flex items-center gap-2">
                            <span className={result.errors_404 > 0 ? 'text-orange-600' : 'text-green-600'}>
                              {result.errors_404}
                            </span>
                            {u4 && net404 !== 0 && (
                              <span className={`text-xs font-semibold ${net404 > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {net404 > 0 ? `+${net404}` : net404}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold">
                          <div className="flex items-center gap-2">
                            {result.broken_links > 0 ? (
                              <span className="text-red-600">{result.broken_links}</span>
                            ) : (
                              <span className="text-slate-400">{/* vide si 0 */}</span>
                            )}
                            {bl && netBL !== 0 && (
                              <span className={`text-xs font-semibold ${netBL > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {netBL > 0 ? `+${netBL}` : netBL}
                              </span>
                            )}
                          </div>
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
                    {(() => {
                      const totalBroken = results.reduce((sum, r) => sum + (r.broken_links || 0), 0)
                      return totalBroken > 0 ? (
                        <span className="text-red-600 text-lg font-bold">{totalBroken}</span>
                      ) : (
                        <span className="text-slate-400">{/* vide si 0 */}</span>
                      )
                    })()}
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
                <span>Suit récursivement chaque lien (max 300 pages/site)</span>
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
                <h2 className="text-lg font-bold text-slate-800">🔗 Liens cassés visibles</h2>
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
              {results.reduce((sum, r) => sum + (r.broken_links_list?.length || 0), 0)} liens cassés visibles détectés
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
                      Lien cassé visible
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

