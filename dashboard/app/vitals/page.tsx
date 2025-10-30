'use client'

import { useState, useEffect } from 'react'
import { Activity, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react'

interface LastCommit {
  sha: string
  date: string
  message: string
  author: string
}

interface SiteVitals {
  domain: string
  city: string
  url: string
  lastCommit?: LastCommit
  health: {
    status: 'online' | 'offline' | 'error'
    statusCode?: number
    responseTime?: number
    sslValid?: boolean
    error?: string
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'À l\'instant'
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} jours`
  
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'online':
      return <CheckCircle2 className="h-5 w-5 text-green-600" />
    case 'offline':
      return <XCircle className="h-5 w-5 text-red-600" />
    default:
      return <AlertCircle className="h-5 w-5 text-yellow-600" />
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'online':
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">En ligne</span>
    case 'offline':
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Hors ligne</span>
    default:
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Erreur</span>
  }
}

export default function VitalsPage() {
  const [vitals, setVitals] = useState<SiteVitals[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const fetchVitals = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    
    try {
      const response = await fetch('/api/vitals')
      const result = await response.json()
      
      if (result.success) {
        setVitals(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch vitals:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  
  useEffect(() => {
    fetchVitals()
  }, [])
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
          <p className="mt-4 text-slate-600 font-medium">Chargement des vitals...</p>
        </div>
      </div>
    )
  }
  
  // Trier par date de dernier commit (plus récent en premier)
  const sortedVitals = [...vitals].sort((a, b) => {
    const dateA = a.lastCommit?.date ? new Date(a.lastCommit.date).getTime() : 0
    const dateB = b.lastCommit?.date ? new Date(b.lastCommit.date).getTime() : 0
    
    // Si même date (ou pas de commit), trier par nom de ville
    if (dateA === dateB) {
      return a.city.localeCompare(b.city)
    }
    
    // Plus récent en premier
    return dateB - dateA
  })
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Vitals des Sites</h1>
          <p className="mt-2 text-lg text-slate-600">
            Santé et dernière mise à jour des 11 sites Moverz
          </p>
        </div>
        
        <button
          onClick={() => fetchVitals(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualisation...' : 'Actualiser'}
        </button>
      </div>
      
      {/* Stats rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            <span className="text-sm text-slate-600">Sites en ligne</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {vitals.filter(v => v.health.status === 'online').length} / {vitals.length}
          </p>
        </div>
        
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-slate-600">Dernier commit moyen</span>
          </div>
          <p className="mt-2 text-sm text-slate-900">
            {(() => {
              const commits = vitals.filter(v => v.lastCommit).map(v => new Date(v.lastCommit!.date))
              if (commits.length === 0) return 'N/A'
              const avg = commits.reduce((a, b) => a + b.getTime(), 0) / commits.length
              return formatRelativeTime(new Date(avg).toISOString())
            })()}
          </p>
        </div>
        
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-slate-600">Temps réponse moyen</span>
          </div>
          <p className="mt-2 text-sm text-slate-900">
            {(() => {
              const times = vitals.filter(v => v.health.responseTime).map(v => v.health.responseTime!)
              if (times.length === 0) return 'N/A'
              const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
              return `${avg} ms`
            })()}
          </p>
        </div>
        
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="text-sm text-slate-600">Sites avec erreurs</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {vitals.filter(v => v.health.status !== 'online').length}
          </p>
        </div>
      </div>
      
      {/* Table des sites */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Site
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Dernier Commit
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Temps Réponse
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Détails
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedVitals.map((vital) => (
                <tr key={vital.domain} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900 capitalize">
                          {vital.city}
                        </p>
                        <p className="text-xs text-slate-500">{vital.domain}</p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(vital.health.status)}
                      {getStatusBadge(vital.health.status)}
                      {vital.health.statusCode && (
                        <span className="text-xs text-slate-500">
                          {vital.health.statusCode}
                        </span>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    {vital.lastCommit ? (
                      <div>
                        <p className="text-sm text-slate-900">
                          {formatRelativeTime(vital.lastCommit.date)}
                        </p>
                        <p className="text-xs text-slate-500 truncate max-w-xs" title={vital.lastCommit.message}>
                          {vital.lastCommit.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {vital.lastCommit.sha} • {vital.lastCommit.author}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">N/A</span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    {vital.health.responseTime !== undefined ? (
                      <span className={`text-sm font-medium ${
                        vital.health.responseTime < 500 ? 'text-green-600' :
                        vital.health.responseTime < 1000 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {vital.health.responseTime} ms
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {vital.health.sslValid && (
                        <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">
                          SSL ✓
                        </span>
                      )}
                      {vital.health.error && (
                        <span className="text-xs text-red-600" title={vital.health.error}>
                          ⚠️
                        </span>
                      )}
                      <a
                        href={vital.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        Ouvrir →
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

