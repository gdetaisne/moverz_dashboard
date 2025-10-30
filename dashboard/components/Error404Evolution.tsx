'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Error404EvolutionProps {
  data: Array<{
    date: string
    nb_scans: number
    avg_pages_checked: number
    avg_errors_404: number
    max_errors_404: number
    min_errors_404: number
    avg_duration_seconds: number
  }>
}

export function Error404Evolution({ data }: Error404EvolutionProps) {
  const formatTickDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'd MMM', { locale: fr })
    } catch {
      return dateStr
    }
  }
  const formatTooltipDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "d MMM HH:mm", { locale: fr })
    } catch {
      return dateStr
    }
  }
  
  // Calculer la tendance
  const getTrend = () => {
    if (data.length < 2) return null
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
    const first = sorted[0].avg_errors_404
    const last = sorted[sorted.length - 1].avg_errors_404
    const diff = last - first
    const percentChange = first > 0 ? ((diff / first) * 100).toFixed(1) : '0.0'
    
    if (diff > 0) return { value: diff, percent: percentChange, direction: 'up' as const }
    if (diff < 0) return { value: Math.abs(diff), percent: percentChange, direction: 'down' as const }
    return { value: 0, percent: '0.0', direction: 'neutral' as const }
  }
  
  const trend = getTrend()
  
  // Préparer les données pour le graphique
  const chartData = [...data].sort((a, b) => a.date.localeCompare(b.date))
  
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Évolution des Erreurs 404
          </h2>
          {trend && (
            <div className="flex items-center gap-2 text-sm">
              {trend.direction === 'up' && (
                <div className="flex items-center gap-1 text-red-600">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-semibold">+{trend.percent}%</span>
                </div>
              )}
              {trend.direction === 'down' && (
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingDown className="h-4 w-4" />
                  <span className="font-semibold">{trend.percent}%</span>
                </div>
              )}
              {trend.direction === 'neutral' && (
                <div className="flex items-center gap-1 text-slate-600">
                  <Minus className="h-4 w-4" />
                  <span className="font-semibold">0%</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="p-6">
        {chartData.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <AlertTriangle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <p>Aucune donnée historique disponible</p>
            <p className="text-sm mt-1">Lancez un scan pour commencer à suivre l&apos;évolution</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatTickDate}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <YAxis 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#cbd5e1"
                />
                <Tooltip 
                  labelFormatter={formatTooltipDate}
                  contentStyle={{ 
                    background: 'white', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    color: '#0f172a'
                  }}
                  formatter={(value: number) => [Math.round(value), 'Erreurs']}
                />
                <Legend 
                  wrapperStyle={{ color: '#475569' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="avg_errors_404" 
                  stroke="#f97316" 
                  strokeWidth={3}
                  name="Erreurs 404 (moyenne)"
                  dot={{ fill: '#f97316', r: 4 }}
                  activeDot={{ r: 6, fill: '#f97316' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="max_errors_404" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Erreurs 404 (max)"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="min_errors_404" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Erreurs 404 (min)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            
            {/* Stats supplémentaires */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200">
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-wide">Scans totaux</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {chartData.reduce((sum, d) => sum + d.nb_scans, 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-wide">Erreurs moyennes</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {Math.round(chartData.reduce((sum, d) => sum + d.avg_errors_404, 0) / chartData.length)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-wide">Pages vérifiées/moy</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {Math.round(chartData.reduce((sum, d) => sum + d.avg_pages_checked, 0) / chartData.length)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-wide">Durée moy (s)</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {Math.round(chartData.reduce((sum, d) => sum + d.avg_duration_seconds, 0) / chartData.length)}s
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

