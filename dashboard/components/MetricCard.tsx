import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  trend?: number
  format?: 'number' | 'percent' | 'position'
  icon?: React.ReactNode
}

export function MetricCard({ title, value, trend, format = 'number', icon }: MetricCardProps) {
  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) return <Minus className="h-4 w-4" />
    return trend > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }
  
  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return 'text-gray-500'
    // Pour la position, une baisse est bonne (position plus haute = meilleur classement)
    if (format === 'position') {
      return trend < 0 ? 'text-green-600' : 'text-red-600'
    }
    return trend > 0 ? 'text-green-600' : 'text-red-600'
  }
  
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{title}</p>
        <div className="text-slate-400">
          {icon}
        </div>
      </div>
      
      <div className="mt-3 flex items-baseline gap-3">
        <p className="text-4xl font-bold text-slate-900">{value}</p>
        
        {trend !== undefined && (
          <span className={cn('flex items-center gap-1 text-sm font-semibold', getTrendColor())}>
            {getTrendIcon()}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

