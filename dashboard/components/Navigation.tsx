'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp, AlertTriangle, Settings, BarChart3, Activity, Sparkles, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Navigation() {
  const pathname = usePathname()
  
  const links = [
    // Vue d'ensemble
    { href: '/', label: 'Vue d\'ensemble', icon: TrendingUp },
    { href: '/insights', label: 'Insights IA', icon: Sparkles },
    
    // Détails
    { href: '/sites', label: 'Sites', icon: Globe },
    
    // Technique
    { href: '/vitals', label: 'Performance', icon: Activity },
    { href: '/404', label: 'Erreurs 404', icon: AlertTriangle },
    
    // Config
    { href: '/settings', label: 'Paramètres', icon: Settings },
  ]
  
  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary-600" />
            <span className="text-xl font-bold">Moverz Analytics</span>
          </div>
          
          <div className="flex gap-1 items-center">
            {links.map((link, idx) => {
              const Icon = link.icon
              const isActive = link.href === '/' 
                ? pathname === '/'
                : pathname.startsWith(link.href)
              
              // Séparateurs entre sections
              const needsSeparator = idx === 2 || idx === 3 || idx === 5
              
              return (
                <div key={link.href} className="flex items-center gap-1">
                  {needsSeparator && (
                    <div className="h-6 w-px bg-gray-300 mx-1" />
                  )}
                  <Link
                    href={link.href}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}

