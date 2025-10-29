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
    <div className="bg-white rounded-lg border p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        {icon}
      </div>
      
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-bold">{value}</p>
        
        {trend !== undefined && (
          <span className={cn('flex items-center gap-1 text-sm font-medium', getTrendColor())}>
            {getTrendIcon()}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

