/**
 * Types partagés pour le système ETL
 */

// ========================================
// SITES & CONFIGURATION
// ========================================

export type City = 
  | 'marseille'
  | 'toulouse'
  | 'lyon'
  | 'bordeaux'
  | 'nantes'
  | 'lille'
  | 'nice'
  | 'strasbourg'
  | 'rouen'
  | 'rennes'
  | 'montpellier'

export interface Site {
  id: string
  city: City
  domain: string
  status: 'active' | 'inactive'
  createdAt: Date
}

// Mapping domaine → ville
export const DOMAIN_TO_CITY: Record<string, City> = {
  'devis-demenageur-marseille.fr': 'marseille',
  'devis-demenageur-toulousain.fr': 'toulouse',
  'devis-demenageur-lyon.fr': 'lyon',
  'www.bordeaux-demenageur.fr': 'bordeaux',
  'bordeaux-demenageur.fr': 'bordeaux', // Rétrocompatibilité
  'devis-demenageur-nantes.fr': 'nantes',
  'devis-demenageur-lille.fr': 'lille',
  'devis-demenageur-nice.fr': 'nice',
  'devis-demenageur-strasbourg.fr': 'strasbourg',
  'devis-demenageur-rouen.fr': 'rouen',
  'devis-demenageur-rennes.fr': 'rennes',
  'devis-demenageur-montpellier.fr': 'montpellier',
}

// Helper pour obtenir la ville depuis le domaine
export function getCityFromDomain(domain: string): City {
  const city = DOMAIN_TO_CITY[domain]
  if (!city) {
    // Fallback: extraire depuis le domaine (ex: devis-demenageur-marseille.fr → marseille)
    const match = domain.match(/demenageur[s]?-([a-z]+)\.fr/)
    if (match) {
      return match[1] as City
    }
    return domain.split('.')[0].replace('devis-demenageur-', '') as City
  }
  return city
}

// Sites par défaut (rétrocompatibilité)
export const SITES: Site[] = [
  { id: '1', city: 'marseille', domain: 'devis-demenageur-marseille.fr', status: 'active', createdAt: new Date('2025-01-01') },
  { id: '2', city: 'toulouse', domain: 'devis-demenageur-toulousain.fr', status: 'active', createdAt: new Date('2025-01-01') },
  { id: '3', city: 'lyon', domain: 'devis-demenageur-lyon.fr', status: 'active', createdAt: new Date('2025-01-01') },
  { id: '4', city: 'bordeaux', domain: 'www.bordeaux-demenageur.fr', status: 'active', createdAt: new Date('2025-01-01') },
  { id: '5', city: 'nantes', domain: 'devis-demenageur-nantes.fr', status: 'active', createdAt: new Date('2025-01-01') },
  { id: '6', city: 'lille', domain: 'devis-demenageur-lille.fr', status: 'active', createdAt: new Date('2025-01-01') },
  { id: '7', city: 'nice', domain: 'devis-demenageur-nice.fr', status: 'active', createdAt: new Date('2025-01-01') },
  { id: '8', city: 'strasbourg', domain: 'devis-demenageur-strasbourg.fr', status: 'active', createdAt: new Date('2025-01-01') },
  { id: '9', city: 'rouen', domain: 'devis-demenageur-rouen.fr', status: 'active', createdAt: new Date('2025-01-01') },
  { id: '10', city: 'rennes', domain: 'devis-demenageur-rennes.fr', status: 'active', createdAt: new Date('2025-01-01') },
  { id: '11', city: 'montpellier', domain: 'devis-demenageur-montpellier.fr', status: 'active', createdAt: new Date('2025-01-01') },
]

// Générer la liste des sites depuis SITES_LIST env (si défini)
export function getSitesFromEnv(): Site[] {
  const sitesListEnv = process.env.SITES_LIST
  if (!sitesListEnv) {
    return SITES
  }

  const domains = sitesListEnv.split(',').map(s => s.trim()).filter(Boolean)
  
  return domains.map((domain, idx) => ({
    id: String(idx + 1),
    city: getCityFromDomain(domain),
    domain,
    status: 'active' as const,
    createdAt: new Date('2025-01-01'),
  }))
}

// ========================================
// GOOGLE SEARCH CONSOLE
// ========================================

export interface GSCGlobalMetrics {
  site: City
  date: string // YYYY-MM-DD
  impressions: number
  clicks: number
  ctr: number
  position: number
}

export interface GSCPageMetrics {
  site: City
  date: string
  url: string
  impressions: number
  clicks: number
  ctr: number
  position: number
}

export interface GSCQueryMetrics {
  site: City
  date: string
  query: string
  impressions: number
  clicks: number
  ctr: number
  position: number
}

// ========================================
// GOOGLE ANALYTICS 4
// ========================================

export type GA4EventName = 
  | 'page_view'
  | 'cta_click'
  | 'form_start'
  | 'form_submit'

export type CTAType = 'hero' | 'sticky' | 'article' | 'pricing'

export interface GA4Event {
  eventDate: string
  eventTimestamp: number
  eventName: GA4EventName
  userPseudoId: string
  device: 'mobile' | 'desktop' | 'tablet'
  country: string
  source?: string
  medium?: string
  pageUrl: string
  city: City
  ctaType?: CTAType
  destination?: string
}

// ========================================
// LEADS
// ========================================

export interface Lead {
  id: string
  createdAt: Date
  site: City
  source: string
  medium?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  formData: Record<string, any>
  status: 'pending' | 'contacted' | 'converted' | 'lost'
}

// ========================================
// WEB VITALS
// ========================================

export type WebVitalMetric = 'LCP' | 'CLS' | 'INP'

export interface WebVitalSample {
  site: City
  date: string
  url: string
  device: 'mobile' | 'desktop'
  metric: WebVitalMetric
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
}

export interface WebVitalAggregate {
  site: City
  date: string
  url: string
  device: 'mobile' | 'desktop'
  metric: WebVitalMetric
  p50: number
  p75: number
  p95: number
  samples: number
}

// ========================================
// ETL JOB
// ========================================

export interface ETLJobResult {
  jobName: string
  startedAt: Date
  completedAt: Date
  status: 'success' | 'partial' | 'failed'
  rowsProcessed: number
  errors: string[]
}

// ========================================
// ALERTS
// ========================================

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface Alert {
  id: string
  createdAt: Date
  severity: AlertSeverity
  site: City
  metric: string
  message: string
  currentValue: number
  previousValue?: number
  threshold?: number
  resolved: boolean
  resolvedAt?: Date
}

