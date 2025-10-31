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
            
            <p className="text-xs text-slate-500 mt-2 border-t pt-2">💡 <strong>Performance</strong> : Le cache serveur est de 6h. En cas d&apos;erreur HTTP ou timeout, les données GSC restent affichées mais la prévisualisation est marquée comme &quot;incertaine&quot;.</p>
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
        </div>
      </div>

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


