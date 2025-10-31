"use client"

import { useEffect, useMemo, useState } from 'react'
import PageIntro from '@/components/PageIntro'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

type SerpPreview = {
  url: string
  title: string | null
  description: string | null
  favicon: string | null
  hasFAQ: boolean
  hasAggregateRating: boolean
  hasBreadcrumb: boolean
  hasHowTo: boolean
  hasArticle: boolean
  hasVideo: boolean
  hasLocalBusiness: boolean
  impressions: number
  sharePct: number
  intent: string | null
  intentDeclared: string | null
  intentInferred: string | null
  intentMatchScore: number
  intentSource: 'meta' | 'jsonld' | 'inferred' | null
  scoreLength: number
  scoreRichResults: number
  ctr: number | null
  position: number | null
  // Métadonnées de fiabilité
  fetchSuccess: boolean
  fetchStatusCode: number | null
  fetchRedirected: boolean
  lastFetched: number | null
}

export default function SerpPage() {
  const [site, setSite] = useState<string>('')
  const [sites, setSites] = useState<string[]>([])
  const [data, setData] = useState<SerpPreview[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState<number>(20)
  const [showExplanation, setShowExplanation] = useState(false)
  const [auditLoading, setAuditLoading] = useState<boolean>(false)
  const [auditResult, setAuditResult] = useState<any>(null)
  const exportLoadingRef = { current: false } // Ref pour éviter double-clic
  // Chargement uniquement sur action utilisateur

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    if (site) params.set('site', site)
    params.set('limit', String(limit))
    return `/api/serp/preview?${params.toString()}`
  }, [site, limit])

  useEffect(() => {
    let ignore = false
    // Charger la liste des sites (11 attendus)
    fetch('/api/metrics/global?days=30')
      .then((r) => r.json())
      .then((json) => {
        if (ignore) return
        if (json?.data) {
          const list = (json.data as any[]).map((x) => x.site).filter(Boolean)
          setSites(list)
        }
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])

  function loadData() {
    setLoading(true)
    setError(null)
    fetch(endpoint)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data)
        else setError(json.error || 'Erreur inconnue')
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }

  async function runAudit() {
    setAuditLoading(true)
    setAuditResult(null)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (site) params.set('site', site)
      params.set('limit', String(limit)) // Utiliser la limite actuelle
      const response = await fetch(`/api/serp/audit?${params.toString()}`, {
        method: 'POST'
      })
      const json = await response.json()
      
      if (json.success) {
        setAuditResult(json.data)
      } else {
        setError(json.error || 'Erreur lors de l\'audit')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setAuditLoading(false)
    }
  }

  async function exportToCSV(type: 'preview' | 'audit') {
    // Éviter double-clic
    if (exportLoadingRef.current) return
    exportLoadingRef.current = true
    
    try {
      // Si les données ne sont pas chargées, les charger d'abord
      if (type === 'preview' && data.length === 0) {
        console.log('📥 Aucune donnée chargée, chargement des données avant export...')
        setLoading(true)
        await loadData()
        // Attendre un peu pour que les données soient disponibles
        await new Promise(resolve => setTimeout(resolve, 1000))
        setLoading(false)
      }
      
      let csvContent = ''
      let filename = ''
      
      if (type === 'preview' && data.length > 0) {
        // Headers
        const headers = [
          'URL', 'Title', 'Description', 'Intent', 'Intent Source',
          'CTR', 'Position', 'Impressions', 'Share %',
          'Title Length', 'Description Length', 'Length Score',
          'Rich Results Score', 'FAQ', 'Rating', 'Breadcrumb', 'HowTo', 'Article', 'Video', 'LocalBusiness',
          'Fetch Success', 'Fetch Status', 'Redirected'
        ]
        csvContent = headers.join(',') + '\n'
        
        // Data rows
        data.forEach(row => {
          const rowData = [
            `"${row.url}"`,
            `"${(row.title || '').replace(/"/g, '""')}"`,
            `"${(row.description || '').replace(/"/g, '""')}"`,
            row.intent || '',
            row.intentSource || '',
            row.ctr ? (row.ctr * 100).toFixed(2) + '%' : '',
            row.position?.toFixed(1) || '',
            row.impressions || 0,
            row.sharePct?.toFixed(2) || '0.00',
            row.title?.length || '',
            row.description?.length || '',
            row.scoreLength?.toFixed(0) || '',
            row.scoreRichResults?.toFixed(0) || '',
            row.hasFAQ ? 'Oui' : 'Non',
            row.hasAggregateRating ? 'Oui' : 'Non',
            row.hasBreadcrumb ? 'Oui' : 'Non',
            row.hasHowTo ? 'Oui' : 'Non',
            row.hasArticle ? 'Oui' : 'Non',
            row.hasVideo ? 'Oui' : 'Non',
            row.hasLocalBusiness ? 'Oui' : 'Non',
            row.fetchSuccess ? 'Oui' : 'Non',
            row.fetchStatusCode || '',
            row.fetchRedirected ? 'Oui' : 'Non'
          ]
          csvContent += rowData.join(',') + '\n'
        })
        
        filename = `serp-preview-${site || 'all'}-${new Date().toISOString().split('T')[0]}.csv`
      } else if (type === 'audit' && auditResult) {
        // Headers pour audit
        const headers = [
          'URL', 'Title Length', 'Description Length', 'Has Title', 'Has Description',
          'Intent', 'Intent Source', 'CTR', 'Position',
          'Length Score', 'Rich Results Score', 'Rich Results Types'
        ]
        csvContent = headers.join(',') + '\n'
        
        // Data rows
        auditResult.pages?.forEach((page: any) => {
          const rowData = [
            `"${page.url}"`,
            page.title_length || '',
            page.description_length || '',
            page.has_title ? 'Oui' : 'Non',
            page.has_description ? 'Oui' : 'Non',
            page.intent || '',
            page.intent_source || '',
            page.ctr ? (page.ctr * 100).toFixed(2) + '%' : '',
            page.position?.toFixed(1) || '',
            page.score_length?.toFixed(0) || '',
            page.score_rich_results?.toFixed(0) || '',
            `"${page.rich_results_types?.join('; ') || ''}"`
          ]
          csvContent += rowData.join(',') + '\n'
        })
        
        filename = `serp-audit-${site || 'all'}-${new Date().toISOString().split('T')[0]}.csv`
      } else {
        alert('Aucune donnée à exporter')
        return
      }
      
      // Créer et télécharger le fichier
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }) // BOM UTF-8 pour Excel
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      exportLoadingRef.current = false
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">SERP – Top {limit} (GSC)</h1>
      <PageIntro
        finalite="Visualiser les requêtes/pages leaders et un aperçu SERP."
        tableaux={['Top 20 résultats (requêtes/pages)', 'Prévisualisation SERP']}
        sources={['Google Search Console', 'Fetcher SERP (aperçu)']}
      />
      
      {/* Section Explication */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-100 transition-colors rounded-lg text-sm"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-500" />
            <span className="text-slate-600 font-medium">Comment fonctionne la prévisualisation SERP ?</span>
          </div>
          {showExplanation ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>
        {showExplanation && (
          <div className="px-4 pb-4 text-sm text-slate-600 space-y-3">
            <div>
              <p className="font-semibold text-slate-700 mb-1">📊 Sources des données :</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Impressions & % total</strong> : provenant de <strong>BigQuery</strong> via Google Search Console (agrégées sur 30 jours). Les pages sont classées par nombre d&apos;impressions décroissant.</li>
                <li><strong>Prévisualisation SERP</strong> : chaque URL est <strong>fetchée en temps réel via HTTP GET</strong> (parallélisme de 5 requêtes simultanées, timeout 5s) pour extraire le contenu HTML.</li>
              </ul>
            </div>
            
            <div>
              <p className="font-semibold text-slate-700 mb-1">🔍 Extraction depuis le HTML :</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Title</strong> : balise &lt;title&gt;</li>
                <li><strong>Description</strong> : meta tag &lt;meta name=&quot;description&quot;&gt;</li>
                <li><strong>Favicon</strong> : balise &lt;link rel=&quot;icon&quot;&gt;</li>
                <li><strong>FAQ/Rating/Breadcrumb/HowTo/Article/Video/LocalBusiness</strong> : détectés via parsing des blocs JSON-LD (&lt;script type=&quot;application/ld+json&quot;&gt;)</li>
                <li><strong>Intent</strong> : extrait depuis meta tags ou JSON-LD (champs &quot;intent&quot; ou &quot;searchIntent&quot;). Si non déclaré, déduit du contenu (URL, titre, description). Source affichée à côté de l&apos;intent.</li>
                <li><strong>Intent Match Score</strong> : comparaison entre intent déclaré vs intent déduit. 100% = match parfait, 0% = mismatch, 50% = incertain.</li>
                <li><strong>Length Score</strong> : binaire conservateur (titre ≤55 chars, description ≤150 chars) pour éviter troncature SERP.</li>
                <li><strong>Rich Results Score</strong> : pourcentage basé sur le nombre de types JSON-LD détectés (7 max).</li>
              </ul>
            </div>
            
            <div>
              <p className="font-semibold text-slate-700 mb-1">✅ Indicateur de fiabilité :</p>
              <p className="ml-2">Calculé sur 100 points : fetch réussi (40pts), titre+description présents (30pts), pas de redirection (20pts), status HTTP 200 (10pts). <span className="font-semibold">✓ Fiable</span> (≥80pts), <span className="font-semibold">⚠ Partiel</span> (≥50pts), <span className="font-semibold">✗ Incertain</span> (&lt;50pts).</p>
            </div>
            
            <div>
              <p className="font-semibold text-slate-700 mb-1">💾 Snapshots automatiques :</p>
              <p className="ml-2">Chaque chargement SERP sauvegarde automatiquement un snapshot dans <strong>BigQuery</strong> (table <code className="text-xs bg-slate-100 px-1 rounded">serp_snapshots</code>) avec toutes les métriques (performance GSC, intent, rich results, scores). Permet le tracking de l&apos;évolution dans le temps et le calcul de benchmarks CTR par intent.</p>
            </div>
            
            <p className="text-xs text-slate-500 mt-2 border-t pt-2">💡 <strong>Performance</strong> : Le cache serveur est de 6h. En cas d&apos;erreur HTTP ou timeout, les données GSC restent affichées mais la prévisualisation est marquée comme &quot;incertaine&quot;. Les snapshots sont sauvegardés de manière non-bloquante (n&apos;impactent pas le temps de réponse).</p>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <label className="text-sm">Site</label>
        <select
          className="border rounded px-2 py-1 text-sm w-80"
          value={site}
          onChange={(e) => setSite(e.target.value)}
        >
          <option value="">Tous les sites</option>
          {sites.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="ml-4 flex items-center gap-2">
          <span className="text-sm text-gray-600">Afficher</span>
          {[20, 100, 200].map((v) => (
            <button
              key={v}
              onClick={() => setLimit(v)}
              className={
                'text-sm px-2 py-1 rounded border ' +
                (limit === v
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')
              }
            >
              {v}
            </button>
          ))}
          <button
            onClick={loadData}
            className="ml-2 text-sm px-3 py-1 rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-60"
            disabled={loading}
          >
            Charger
          </button>
          <button
            onClick={runAudit}
            className="ml-4 text-sm px-4 py-1 rounded border bg-purple-600 text-white border-purple-700 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed font-semibold"
            disabled={auditLoading || loading}
          >
            {auditLoading ? 'Audit en cours...' : `🔍 Audit TOP ${limit}`}
          </button>
          <button
            onClick={() => exportToCSV('preview')}
            className="ml-2 text-sm px-3 py-1 rounded border bg-green-600 text-white border-green-700 hover:bg-green-700 disabled:opacity-60"
            title="Exporter les résultats SERP en CSV (charge si nécessaire)"
            disabled={loading || auditLoading}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Section Résultats Audit */}
      {auditResult && (
        <div className="bg-white border border-purple-200 rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-purple-900">📊 Résultats Audit TOP {limit}</h2>
            <button
              onClick={() => exportToCSV('audit')}
              className="text-sm px-3 py-1 rounded border bg-purple-600 text-white border-purple-700 hover:bg-purple-700"
              title="Exporter les résultats d'audit en CSV"
            >
              📥 Export Audit CSV
            </button>
          </div>
          
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600">Pages analysées</div>
              <div className="text-2xl font-bold text-blue-900">{auditResult.summary.crawled}</div>
              {auditResult.summary.failed > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-red-600 font-semibold">{auditResult.summary.failed} échecs</div>
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">Détails échecs</summary>
                    <ul className="list-disc list-inside mt-1 text-slate-600 space-y-0.5">
                      {auditResult.summary.failed_pages?.slice(0, 5).map((f: any, i: number) => (
                        <li key={i} className="truncate">{f.url} <span className="text-orange-600">({f.reason})</span></li>
                      ))}
                      {auditResult.summary.failed_pages?.length > 5 && (
                        <li className="text-slate-400">... et {auditResult.summary.failed_pages.length - 5} autres</li>
                      )}
                    </ul>
                  </details>
                </div>
              )}
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600">Durée</div>
              <div className="text-2xl font-bold text-green-900">{auditResult.summary.duration_seconds}s</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-orange-600">CTR moyen</div>
              <div className="text-2xl font-bold text-orange-900">{(auditResult.performance.avg_ctr || 0).toFixed(2)}%</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-purple-600">Position moyenne</div>
              <div className="text-2xl font-bold text-purple-900">{auditResult.performance.avg_position.toFixed(1)}</div>
            </div>
          </div>

          {/* Recommandations */}
          <div>
            <h3 className="text-lg font-semibold mb-3">🎯 Recommandations</h3>
            <div className="space-y-2">
              {auditResult.recommendations.map((rec: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-l-4 ${
                    rec.severity === 'high' ? 'bg-red-50 border-red-500' :
                    rec.severity === 'medium' ? 'bg-orange-50 border-orange-500' :
                    'bg-yellow-50 border-yellow-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900">{rec.title}</div>
                      <div className="text-sm text-slate-600 mt-1">{rec.description}</div>
                      <div className="text-xs text-slate-500 mt-2">📍 {rec.affected_pages} pages concernées</div>
                      {rec.examples && rec.examples.length > 0 && (
                        <div className="mt-2 text-xs">
                          <strong>Exemples :</strong>
                          <ul className="list-disc list-inside ml-2 mt-1">
                            {rec.examples.slice(0, 3).map((ex: string, i: number) => (
                              <li key={i} className="truncate">{ex}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      rec.severity === 'high' ? 'bg-red-200 text-red-800' :
                      rec.severity === 'medium' ? 'bg-orange-200 text-orange-800' :
                      'bg-yellow-200 text-yellow-800'
                    }`}>
                      {rec.severity.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Meta Formats */}
          <div>
            <h3 className="text-lg font-semibold mb-3">📝 Format Meta Données</h3>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-slate-600">Titles manquants</div>
                <div className="text-xl font-bold text-red-600">{auditResult.meta_formats.title_missing}</div>
              </div>
              <div>
                <div className="text-slate-600">Descriptions manquantes</div>
                <div className="text-xl font-bold text-red-600">{auditResult.meta_formats.description_missing}</div>
              </div>
              <div>
                <div className="text-slate-600">Titles trop longs</div>
                <div className="text-xl font-bold text-orange-600">{auditResult.meta_formats.title_too_long}</div>
              </div>
              <div>
                <div className="text-slate-600">Descriptions trop longues</div>
                <div className="text-xl font-bold text-orange-600">{auditResult.meta_formats.description_too_long}</div>
              </div>
            </div>
          </div>

          {/* Rich Results */}
          <div>
            <h3 className="text-lg font-semibold mb-3">⭐ Rich Results</h3>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-slate-600">Avec FAQ</div>
                <div className="text-xl font-bold">{auditResult.rich_results.total_with_faq}</div>
              </div>
              <div>
                <div className="text-slate-600">Avec Rating</div>
                <div className="text-xl font-bold">{auditResult.rich_results.total_with_rating}</div>
              </div>
              <div>
                <div className="text-slate-600">Sans Rich Results</div>
                <div className="text-xl font-bold text-orange-600">{auditResult.rich_results.total_with_none}</div>
              </div>
              <div>
                <div className="text-slate-600">Score moyen</div>
                <div className="text-xl font-bold">{auditResult.rich_results.avg_score.toFixed(0)}%</div>
              </div>
            </div>
          </div>

          {/* Intent Analysis */}
          <div>
            <h3 className="text-lg font-semibold mb-3">🎯 Analyse Intent</h3>
            <div className="grid grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-slate-600">Déclaré (meta)</div>
                <div className="text-xl font-bold">{auditResult.intent_analysis.declared_meta}</div>
              </div>
              <div>
                <div className="text-slate-600">Déclaré (JSON-LD)</div>
                <div className="text-xl font-bold">{auditResult.intent_analysis.declared_jsonld}</div>
              </div>
              <div>
                <div className="text-slate-600">Déduit</div>
                <div className="text-xl font-bold">{auditResult.intent_analysis.inferred}</div>
              </div>
              <div>
                <div className="text-slate-600">Mismatch</div>
                <div className="text-xl font-bold text-orange-600">{auditResult.intent_analysis.mismatch_count}</div>
              </div>
              <div>
                <div className="text-slate-600">Manquant</div>
                <div className="text-xl font-bold text-red-600">{auditResult.intent_analysis.missing}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-sm">Chargement…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Aperçu</th>
                <th className="py-2 pr-4">URL</th>
                <th className="py-2 pr-4">Impr. 30j</th>
                <th className="py-2 pr-4">% total</th>
                <th className="py-2 pr-4">Signaux</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.url} className="border-b align-top">
                  <td className="py-3 pr-4 max-w-xl">
                    <div className="flex items-start gap-2">
                      {row.favicon ? (
                        <img src={row.favicon} alt="favicon" className="w-5 h-5 mt-1" />
                      ) : (
                        <div className="w-5 h-5 bg-gray-200 mt-1" />
                      )}
                      <div className="flex-1">
                        {/* Badge de fiabilité */}
                        {(() => {
                          const reliability = calculateReliability(row)
                          return (
                            <div className="mb-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                reliability === 'high' ? 'bg-green-100 text-green-700' :
                                reliability === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {reliability === 'high' ? '✓ Fiable' : 
                                 reliability === 'medium' ? '⚠ Partiel' : '✗ Incertain'}
                              </span>
                            </div>
                          )
                        })()}
                        
                        <div className="text-blue-700 hover:underline line-clamp-2">
                          {row.title || '(sans titre)'}
                        </div>
                        <div className="text-green-700 text-xs mt-0.5 line-clamp-1">
                          {formatSerpBreadcrumb(row.url)}
                        </div>
                        <div className="text-gray-700 text-xs mt-1 line-clamp-3">
                          {row.description || '(meta description manquante)'}
                        </div>
                        {row.intent && (
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                              🎯 {row.intent}
                            </span>
                            <span className="text-xs text-slate-500">
                              {row.intentSource === 'meta' && '(meta tag)'}
                              {row.intentSource === 'jsonld' && '(présent dans JSON-LD)'}
                              {row.intentSource === 'inferred' && '(déduit, non présent dans JSON)'}
                              {!row.intentSource && '(à préciser dans le rapport)'}
                            </span>
                            {row.intentMatchScore < 100 && row.intentDeclared && row.intentInferred && (
                              <span className="text-xs text-orange-600">
                                ⚠️ Mismatch déclaré vs déduit
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="space-y-1">
                      <a href={row.url} className="text-blue-700 underline break-all text-xs" target="_blank" rel="noreferrer">
                        {row.url}
                      </a>
                      {row.intent && (
                        <div className="text-xs">
                          <span className="text-slate-600">Intent: </span>
                          <span className="font-medium text-purple-700">{row.intent}</span>
                          <span className="text-slate-500 ml-1">
                            ({row.intentSource === 'meta' ? 'meta tag' : row.intentSource === 'jsonld' ? 'présent dans JSON-LD' : row.intentSource === 'inferred' ? 'déduit, non présent dans JSON' : 'source inconnue'})
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {Intl.NumberFormat('fr-FR').format(row.impressions || 0)}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {(row.sharePct || 0).toFixed(2)}%
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    <div className="space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <Badge active={row.hasFAQ}>FAQ</Badge>
                        <Badge active={row.hasAggregateRating}>Rating</Badge>
                        <Badge active={row.hasBreadcrumb}>Breadcrumb</Badge>
                        <Badge active={row.hasHowTo}>HowTo</Badge>
                        <Badge active={row.hasArticle}>Article</Badge>
                        <Badge active={row.hasVideo}>Video</Badge>
                        <Badge active={row.hasLocalBusiness}>LocalBusiness</Badge>
                      </div>
                      {row.scoreLength < 100 && (
                        <div className="text-orange-600 text-xs mt-1">
                          ⚠️ Length: {row.scoreLength}% (title ≤55, desc ≤150)
                        </div>
                      )}
                      {row.scoreRichResults > 0 && (
                        <div className="text-green-600 text-xs">
                          ✅ Rich Results: {row.scoreRichResults.toFixed(0)}%
                        </div>
                      )}
                      {row.intentMatchScore < 100 && row.intentDeclared && (
                        <div className="text-orange-600 text-xs">
                          ⚠️ Intent Match: {row.intentMatchScore}% (déclaré ≠ déduit)
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Badge({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={
        'inline-block px-2 py-0.5 rounded border ' +
        (active ? 'bg-green-50 border-green-600 text-green-700' : 'bg-gray-50 border-gray-300 text-gray-500')
      }
    >
      {children}
    </span>
  )
}

function formatSerpBreadcrumb(url: string | null | undefined): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    const pathParts = u.pathname.split('/').filter(Boolean)
    
    // Si pas de path, retourner hostname seul
    if (pathParts.length === 0) {
      return u.hostname
    }
    
    // Formater : www.domain.com > path1 > path2
    return [u.hostname, ...pathParts].join(' > ')
  } catch {
    return url
  }
}

function calculateReliability(preview: SerpPreview): 'high' | 'medium' | 'low' {
  let score = 0
  
  if (preview.fetchSuccess) score += 40
  if (preview.title && preview.description) score += 30
  if (!preview.fetchRedirected) score += 20
  if (preview.fetchStatusCode === 200) score += 10
  
  if (score >= 80) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}


