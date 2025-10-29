'use client'

import { useState } from 'react'
import { AlertTriangle, Search, RefreshCw, ExternalLink } from 'lucide-react'
import { formatNumber } from '@/lib/utils'

interface ScanResult {
  site: string
  total_checked: number
  errors_404: number
  errors_list: string[]
  scan_date: string
}

export default function NotFoundPage() {
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState<ScanResult[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [lastScan, setLastScan] = useState<string | null>(null)
  
  async function runScan() {
    if (scanning) return
    
    setScanning(true)
    try {
      const response = await fetch('/api/404/scan', {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (data.success) {
        setResults(data.data)
        setSummary(data.summary)
        setLastScan(data.timestamp)
      } else {
        alert('❌ Erreur lors du scan : ' + data.message)
      }
    } catch (error) {
      console.error('Failed to run scan:', error)
      alert('❌ Erreur lors du scan des 404')
    } finally {
      setScanning(false)
    }
  }
  
  const totalErrors = results.reduce((sum, r) => sum + r.errors_404, 0)
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-10 w-10 text-orange-600" />
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Erreurs 404</h1>
            <p className="mt-2 text-lg text-slate-600">Scanner de pages introuvables sur les 11 sites Moverz</p>
          </div>
        </div>
        
        <button
          onClick={runScan}
          disabled={scanning}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
        >
          {scanning ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Analyser les 404
            </>
          )}
        </button>
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
                    Pages Vérifiées
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Erreurs 404
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Taux d'Erreur
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Pages Cassées
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
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {result.total_checked}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold">
                          <span className={result.errors_404 > 0 ? 'text-orange-600' : 'text-green-600'}>
                            {result.errors_404}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          {errorRate}%
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {result.errors_list.length > 0 ? (
                            <div className="space-y-1">
                              {result.errors_list.map((path, idx) => (
                                <div key={idx} className="text-xs font-mono bg-red-50 text-red-700 px-2 py-1 rounded">
                                  {path}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-green-600 font-medium">✅ Aucune</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 p-12 shadow-sm text-center">
          <AlertTriangle className="h-16 w-16 text-orange-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Aucun scan effectué</h2>
          <p className="text-slate-600 mb-6">
            Cliquez sur "Analyser les 404" pour lancer un scan des 11 sites.
          </p>
          <p className="text-sm text-slate-500">
            Le scan vérifie les pages principales (/, /blog, /devis, /contact, etc.) et détecte les erreurs 404.
          </p>
        </div>
      )}
    </div>
  )
}

