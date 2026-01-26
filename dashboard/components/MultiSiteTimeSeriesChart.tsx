'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface MultiSiteTimeSeriesChartProps {
  data: Array<{
    date: string
    site: string
    clicks: number
    impressions: number
    ctr?: number
    position?: number
  }>
  metric: 'clicks' | 'impressions' | 'ctr'
  height?: number | string
}

const COLORS = [
  '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6',
  '#ec4899', '#22c55e', '#6366f1', '#eab308', '#06b6d4', '#f97316'
]

export function MultiSiteTimeSeriesChart({ data, metric, height }: MultiSiteTimeSeriesChartProps) {
  const [hoveredSite, setHoveredSite] = useState<string | null>(null)
  const formatValue = (value: number) => {
    if (metric === 'ctr') return `${(value * 100).toFixed(2)}%`
    return value.toString()
  }
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'd MMM', { locale: fr })
    } catch {
      return dateStr
    }
  }

  // Collect unique sites
  const sites = useMemo(() => Array.from(new Set(data.map(d => d.site))).sort(), [data])

  // Index by date, pivot values by site
  const byDate: Record<string, any> = {}
  if (metric === 'ctr') {
    const bySite: Record<string, Array<{ date: string; ctr: number }>> = {}
    for (const d of data) {
      if (!bySite[d.site]) bySite[d.site] = []
      bySite[d.site].push({ date: d.date, ctr: d.ctr ?? 0 })
    }
    for (const site of Object.keys(bySite)) {
      const rows = bySite[site].sort((a, b) => a.date.localeCompare(b.date))
      const values = rows.map((r) => r.ctr)
      const rolling = values.map((_, idx) => {
        const start = Math.max(0, idx - 6)
        const slice = values.slice(start, idx + 1)
        const sum = slice.reduce((acc, v) => acc + v, 0)
        return slice.length > 0 ? sum / slice.length : 0
      })
      rows.forEach((row, idx) => {
        if (!byDate[row.date]) byDate[row.date] = { date: row.date }
        byDate[row.date][site] = rolling[idx]
      })
    }
  } else {
    for (const d of data) {
      if (!byDate[d.date]) byDate[d.date] = { date: d.date }
      if (metric === 'clicks') byDate[d.date][d.site] = d.clicks
      if (metric === 'impressions') byDate[d.date][d.site] = d.impressions
    }
  }

  // Build sorted array by date ASC for charting
  const rows = Object.values(byDate).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))

  return (
    <ResponsiveContainer width="100%" height={height ?? 300}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis 
          dataKey="date" 
          tickFormatter={formatDate}
          tick={{ fill: '#64748b', fontSize: 12 }}
          stroke="#cbd5e1"
        />
        <YAxis 
          tick={{ fill: '#64748b', fontSize: 12 }}
          stroke="#cbd5e1"
          domain={metric === 'ctr' ? [0, 0.02] : undefined}
          tickFormatter={metric === 'ctr' ? (value) => formatValue(Number(value)) : undefined}
        />
        <Tooltip 
          labelFormatter={formatDate}
          formatter={metric === 'ctr' ? (value) => formatValue(Number(value)) : undefined}
          contentStyle={{ 
            background: 'white', 
            border: '1px solid #e2e8f0',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            color: '#0f172a'
          }}
          labelStyle={{ color: '#0f172a', fontWeight: 600 }}
        />
        <Legend 
          wrapperStyle={{ color: '#475569' }}
          onMouseEnter={(o: any) => setHoveredSite(String(o.dataKey ?? o.value ?? ''))}
          onMouseLeave={() => setHoveredSite(null)}
        />
        {sites.map((site, idx) => (
          <Line
            key={site}
            type="monotone"
            dataKey={site}
            name={site}
            stroke={COLORS[idx % COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: COLORS[idx % COLORS.length] }}
            strokeOpacity={hoveredSite && hoveredSite !== site ? 0.15 : 1}
            onMouseEnter={() => setHoveredSite(site)}
            onMouseLeave={() => setHoveredSite(null)}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export default MultiSiteTimeSeriesChart


