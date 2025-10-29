'use client'

import { ArrowUpDown } from 'lucide-react'
import { formatNumber, formatPercent, formatPosition } from '@/lib/utils'

interface SiteData {
  site: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  trend_clicks?: number
  trend_impressions?: number
  linkingLabel?: string
}

interface GroupedDataTableProps {
  withLinking: SiteData[]
  withoutLinking: SiteData[]
  subtotalWithLinking: SiteData
  subtotalWithoutLinking: SiteData
  grandTotal: SiteData
}

export function GroupedDataTable({
  withLinking,
  withoutLinking,
  subtotalWithLinking,
  subtotalWithoutLinking,
  grandTotal,
}: GroupedDataTableProps) {
  
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
  
  const renderRow = (row: SiteData, isSubtotal = false, isTotal = false) => {
    const bgClass = isTotal 
      ? 'bg-primary-50 border-y-2 border-primary-200' 
      : isSubtotal 
      ? 'bg-slate-100 border-y border-slate-300' 
      : 'hover:bg-slate-50'
    
    const textClass = (isTotal || isSubtotal) ? 'font-bold text-slate-900' : 'font-medium text-slate-900'
    
    return (
      <tr key={row.site || 'subtotal'} className={`transition-colors ${bgClass}`}>
        <td className={`px-6 py-4 text-sm ${textClass}`}>
          {isTotal ? '📊 TOTAL GÉNÉRAL' : isSubtotal ? (row.site === 'with' ? '✅ Sous-total AVEC Linking' : '❌ Sous-total SANS Linking') : row.site}
        </td>
        <td className={`px-6 py-4 text-sm ${textClass}`}>
          {isTotal || isSubtotal ? '' : row.linkingLabel || ''}
        </td>
        <td className={`px-6 py-4 text-sm ${textClass}`}>
          {formatCell(row.impressions, 'number')}
        </td>
        <td className={`px-6 py-4 text-sm ${textClass}`}>
          {formatCell(row.clicks, 'number')}
        </td>
        <td className={`px-6 py-4 text-sm ${textClass}`}>
          {formatCell(row.ctr, 'percent')}
        </td>
        <td className={`px-6 py-4 text-sm ${textClass}`}>
          {formatCell(row.position, 'position')}
        </td>
      </tr>
    )
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
              Site
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
              🔗 Linking
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
              Impressions
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
              Clics
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
              CTR
            </th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
              Position
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {/* Section AVEC Linking */}
          {withLinking.length > 0 && (
            <>
              <tr className="bg-green-50">
                <td colSpan={6} className="px-6 py-3 text-sm font-bold text-green-800 uppercase tracking-wide">
                  ✅ Sites AVEC Linking ({withLinking.length} sites)
                </td>
              </tr>
              {withLinking.map(row => renderRow(row))}
              {renderRow({ ...subtotalWithLinking, site: 'with' }, true)}
            </>
          )}
          
          {/* Section SANS Linking */}
          {withoutLinking.length > 0 && (
            <>
              <tr className="bg-orange-50">
                <td colSpan={6} className="px-6 py-3 text-sm font-bold text-orange-800 uppercase tracking-wide">
                  ❌ Sites SANS Linking ({withoutLinking.length} sites)
                </td>
              </tr>
              {withoutLinking.map(row => renderRow(row))}
              {renderRow({ ...subtotalWithoutLinking, site: 'without' }, true)}
            </>
          )}
          
          {/* Total Général */}
          {renderRow(grandTotal, false, true)}
        </tbody>
      </table>
    </div>
  )
}

