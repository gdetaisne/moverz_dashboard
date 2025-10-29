'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface TimeSeriesChartProps {
  data: Array<{
    date: string
    clicks: number
    impressions: number
  }>
  metric: 'clicks' | 'impressions' | 'ctr' | 'position'
}

export function TimeSeriesChart({ data, metric }: TimeSeriesChartProps) {
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'd MMM', { locale: fr })
    } catch {
      return dateStr
    }
  }
  
  const getMetricConfig = () => {
    switch (metric) {
      case 'clicks':
        return { dataKey: 'clicks', stroke: '#0ea5e9', name: 'Clics' }
      case 'impressions':
        return { dataKey: 'impressions', stroke: '#8b5cf6', name: 'Impressions' }
      case 'ctr':
        return { dataKey: 'ctr', stroke: '#10b981', name: 'CTR' }
      case 'position':
        return { dataKey: 'position', stroke: '#f59e0b', name: 'Position' }
    }
  }
  
  const config = getMetricConfig()
  
  // Aggregate data by date (sum all sites)
  const aggregated = data.reduce((acc, item) => {
    const existing = acc.find(d => d.date === item.date)
    if (existing) {
      existing.clicks += item.clicks
      existing.impressions += item.impressions
    } else {
      acc.push({ ...item })
    }
    return acc
  }, [] as Array<{date: string, clicks: number, impressions: number}>)
  
  // Sort by date
  const sorted = aggregated.sort((a, b) => a.date.localeCompare(b.date))
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={sorted}>
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
        />
        <Tooltip 
          labelFormatter={formatDate}
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
        />
        <Line 
          type="monotone" 
          dataKey={config.dataKey} 
          stroke={config.stroke} 
          strokeWidth={3}
          name={config.name}
          dot={false}
          activeDot={{ r: 6, fill: config.stroke }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

