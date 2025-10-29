'use client'

import { useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { formatNumber, formatPercent, formatPosition } from '@/lib/utils'

interface Column<T> {
  key: keyof T
  label: string
  format?: 'number' | 'percent' | 'position' | 'text'
  sortable?: boolean
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
}

export function DataTable<T extends Record<string, any>>({ data, columns }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }
  
  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0
    
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    return sortDirection === 'asc' 
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal))
  })
  
  const formatCell = (value: any, format?: string) => {
    if (value === null || value === undefined) return '-'
    
    switch (format) {
      case 'number':
        return formatNumber(Number(value))
      case 'percent':
        return formatPercent(Number(value))
      case 'position':
        return formatPosition(Number(value))
      default:
        return String(value)
    }
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider"
              >
                {column.sortable !== false ? (
                  <button
                    onClick={() => handleSort(column.key)}
                    className="flex items-center gap-2 hover:text-primary-600 transition-colors"
                  >
                    {column.label}
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {sortedData.map((row, idx) => (
            <tr key={idx} className="hover:bg-slate-50 transition-colors">
              {columns.map((column) => (
                <td key={String(column.key)} className="px-6 py-4 text-sm font-medium text-slate-900">
                  {formatCell(row[column.key], column.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

