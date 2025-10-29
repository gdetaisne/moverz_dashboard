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
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
        <XAxis 
          dataKey="date" 
          tickFormatter={formatDate}
          className="text-sm"
        />
        <YAxis className="text-sm" />
        <Tooltip 
          labelFormatter={formatDate}
          contentStyle={{ 
            background: 'white', 
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem' 
          }}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey={config.dataKey} 
          stroke={config.stroke} 
          strokeWidth={2}
          name={config.name}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

