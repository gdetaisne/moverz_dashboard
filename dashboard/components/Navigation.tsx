'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { TrendingUp, AlertTriangle, Settings, BarChart3, Activity, Sparkles, Globe, Search, CheckSquare, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Tooltip from './Tooltip'

export function Navigation() {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  
  const links = [
    // Vue d'ensemble
    { 
      href: '/', label: 'Vue d\'ensemble', icon: TrendingUp, title: 'KPIs globaux et tendances récentes',
      help: {
        finalite: 'Suivre l\'état global du trafic SEO et les tendances récentes.',
        tableaux: ['KPI cards (impressions, clics, CTR, position)', 'Évolution des impressions et des clics', 'Comparatif sites avec/sans linking'],
        sources: ['Google Search Console (tables agrégées quotidiennes)', 'Calculs locaux côté app']
      }
    },
    { 
      href: '/insights', label: 'Insights IA', icon: Sparkles, title: 'Recommandations et analyses par l\'IA',
      help: {
        finalite: 'Identifier automatiquement opportunités et anomalies SEO.',
        tableaux: ['Carte d\'insight global', 'Actions recommandées'],
        sources: ['BigQuery (métriques GSC)', 'Analyse IA orchestrée']
      }
    },
    
    // Détails
    { 
      href: '/sites', label: 'Sites', icon: Globe, title: 'Vue détaillée par site',
      help: {
        finalite: 'Analyser la performance par domaine.',
        tableaux: ['KPIs du site', 'Top pages', 'Évolution des métriques'],
        sources: ['GSC agrégé par domaine']
      }
    },
    { 
      href: '/serp', label: 'SERP', icon: Search, title: 'Top 20 via GSC + aperçu SERP',
      help: {
        finalite: 'Visualiser les requêtes/pages leaders et un aperçu SERP.',
        tableaux: ['Top 20 résultats (requêtes/pages)', 'Prévisualisation SERP'],
        sources: ['Google Search Console', 'Fetcher SERP (aperçu)']
      }
    },
    { 
      href: '/seo-checks', label: 'SEO checks', icon: CheckSquare, title: 'Checklist SEO complète (100 points)',
      help: {
        finalite: 'Exécuter une checklist exhaustive et prioriser les actions.',
        tableaux: ['Checklist 100 points', 'Score global & par catégorie', 'Export rapport (Markdown)'],
        sources: ['Google Search Central', 'Web.dev', 'Schema.org']
      }
    },
    
    
    // Technique
    { 
      href: '/vitals', label: 'Performance', icon: Activity, title: 'Web Vitals et vitesse',
      help: {
        finalite: 'Suivre la santé et les performances techniques.',
        tableaux: ['Dernier déploiement', 'Dernier commit', 'Statut et vitals clés'],
        sources: ['Sondes internes', 'GitHub', 'Web Vitals']
      }
    },
    { 
      href: '/404', label: 'Erreurs 404', icon: AlertTriangle, title: 'Suivi et historique des erreurs 404',
      help: {
        finalite: 'Mesurer et réduire les erreurs 404 sur les sites.',
        tableaux: ['Historique par scan', 'Évolution des erreurs'],
        sources: ['Crawler interne enregistré dans BigQuery']
      }
    },
    { 
      href: '/gsc-issues', label: 'Alertes GSC', icon: AlertTriangle, title: 'Alertes et problèmes d\'indexation Search Console',
      help: {
        finalite: 'Surveiller les problèmes d\'indexation détectés par Google Search Console.',
        tableaux: ['Liste des alertes', 'Pages affectées', 'Statistiques par type'],
        sources: ['API Search Console URL Inspection', 'BigQuery table gsc_issues']
      }
    },
    
    // Config
    { 
      href: '/settings', label: 'Paramètres', icon: Settings, title: 'Configuration du dashboard',
      help: {
        finalite: 'Configurer les accès, sources et options.',
        tableaux: ['Clés et paramètres'],
        sources: ['Variables d\'environnement', 'Stockage local']
      }
    },
  ]
  
  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary-600" />
            <span className="text-xl font-bold">Moverz Analytics</span>
          </div>
          {/* Bouton menu mobile */}
          <button
            className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Ouvrir le menu"
            onClick={() => setIsMobileOpen((v) => !v)}
          >
            {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Liens desktop */}
          <div className="hidden md:flex gap-1 items-center">
            {links.map((link, idx) => {
              const Icon = link.icon
              const isActive = link.href === '/' 
                ? pathname === '/'
                : pathname.startsWith(link.href)
              
              // Séparateurs entre sections (Vue d'ensemble | Détails | Technique | Config)
              const needsSeparator = idx === 2 || idx === 5 || idx === 7
              
              return (
                <div key={link.href} className="flex items-center gap-1">
                  {needsSeparator && (
                    <div className="h-6 w-px bg-gray-300 mx-1" />
                  )}
                  <Tooltip
                    content={(
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Finalité</div>
                        <div className="mb-2 text-slate-800">{link.help?.finalite || link.title}</div>
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Liste des tableaux</div>
                        <ul className="list-disc pl-5 mb-2 text-slate-800">
                          {(link.help?.tableaux || []).map((t: string) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Sources d&apos;informations</div>
                        <ul className="list-disc pl-5 text-slate-800">
                          {(link.help?.sources || []).map((s: string) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  >
                    <Link
                      href={link.href}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                        isActive
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      )}
                      aria-label={link.title || link.label}
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  </Tooltip>
                </div>
              )
            })}
          </div>
        </div>
        {/* Menu mobile déroulant */}
        {isMobileOpen && (
          <div className="md:hidden pb-3">
            <div className="grid grid-cols-1 gap-1">
              {links.map((link) => {
                const Icon = link.icon
                const isActive = link.href === '/' 
                  ? pathname === '/'
                  : pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    )}
                    aria-label={link.title || link.label}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

