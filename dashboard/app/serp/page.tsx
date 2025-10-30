"use client"

import { useEffect, useMemo, useState } from 'react'
import PageIntro from '@/components/PageIntro'

type SerpPreview = {
  url: string
  title: string | null
  description: string | null
  favicon: string | null
  hasFAQ: boolean
  hasAggregateRating: boolean
  hasBreadcrumb: boolean
  impressions: number
  sharePct: number
}

export default function SerpPage() {
  const [site, setSite] = useState<string>('')
  const [sites, setSites] = useState<string[]>([])
  const [data, setData] = useState<SerpPreview[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState<number>(20)
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
                      <div>
                        <div className="text-blue-700 hover:underline line-clamp-2">
                          {row.title || '(sans titre)'}
                        </div>
                        <div className="text-green-700 text-xs mt-0.5 line-clamp-1">
                          {safeHostname(row.url)}
                        </div>
                        <div className="text-gray-700 text-xs mt-1 line-clamp-3">
                          {row.description || '(meta description manquante)'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <a href={row.url} className="text-blue-700 underline break-all" target="_blank" rel="noreferrer">
                      {row.url}
                    </a>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {Intl.NumberFormat('fr-FR').format(row.impressions || 0)}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {(row.sharePct || 0).toFixed(2)}%
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    <div className="flex gap-2 flex-wrap">
                      <Badge active={row.hasFAQ}>FAQ</Badge>
                      <Badge active={row.hasAggregateRating}>Rating</Badge>
                      <Badge active={row.hasBreadcrumb}>Breadcrumb</Badge>
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

function safeHostname(url: string | null | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}


