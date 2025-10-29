'use client'

import { cn } from '@/lib/utils'

interface PeriodSelectorProps {
  value: number
  onChange: (days: number) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const periods = [
    { label: '7 jours', days: 7 },
    { label: '28 jours', days: 28 },
    { label: '90 jours', days: 90 },
  ]
  
  return (
    <div className="inline-flex gap-1 bg-gray-100 rounded-lg p-1">
      {periods.map((period) => (
        <button
          key={period.days}
          onClick={() => onChange(period.days)}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            value === period.days
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          {period.label}
        </button>
      ))}
    </div>
  )
}

