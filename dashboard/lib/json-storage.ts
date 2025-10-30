import fs from 'fs'
import path from 'path'

const STORAGE_FILE = path.join(process.cwd(), 'data', 'errors-404-history.json')
const URLS_STORAGE_FILE = path.join(process.cwd(), 'data', 'errors-404-urls.json')

interface Error404HistoryEntry {
  id: string
  scan_date: string
  total_sites: number
  total_pages_checked: number
  total_errors_404: number
  sites_results: Array<{
    site: string
    total_checked: number
    errors_404: number
    broken_links?: number
  }>
  crawl_duration_seconds: number
  created_at: string
}

// Reconstruire le dernier scan détaillé (par site) avec liens cassés visibles
export interface ReconstructedSiteScan {
  site: string
  total_checked: number
  errors_404: number
  errors_list: string[]
  broken_links: number
  broken_links_list: Array<{ source: string; target: string }>
  scan_date: string
}

export interface ReconstructedScanResponse {
  scan_id: string
  scan_date: string
  results: ReconstructedSiteScan[]
  summary: {
    total_sites: number
    total_checked: number
    total_errors: number
  }
}

export interface BrokenLink {
  source: string
  target: string
}

export interface SiteBrokenLinks {
  site: string
  broken_links: BrokenLink[]
  last_scan_date: string
}

export interface Error404Evolution {
  date: string
  nb_scans: number
  avg_pages_checked: number
  avg_errors_404: number
  max_errors_404: number
  min_errors_404: number
  avg_duration_seconds: number
}

// ==============================
// URL-level storage (new)
// ==============================

export type UrlStatusCode = '404' | '410'

export interface Error404UrlEntry {
  site: string
  path: string
  status: UrlStatusCode
}

export interface Error404UrlScan {
  scan_id: string
  scan_date: string
  commit_sha?: string
  branch?: string
  actor?: string
  repo?: string
  entries: Error404UrlEntry[]
}

// S'assurer que le dossier data existe
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

// Lire les données existantes
function readData(): Error404HistoryEntry[] {
  ensureDataDir()
  
  if (!fs.existsSync(STORAGE_FILE)) {
    return []
  }
  
  try {
    const content = fs.readFileSync(STORAGE_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to read history file:', error)
    return []
  }
}

function readUrlsData(): Error404UrlScan[] {
  ensureDataDir()
  if (!fs.existsSync(URLS_STORAGE_FILE)) {
    return []
  }
  try {
    const content = fs.readFileSync(URLS_STORAGE_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to read URLs history file:', error)
    return []
  }
}

// Écrire les données
function writeData(data: Error404HistoryEntry[]) {
  ensureDataDir()
  
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Failed to write history file:', error)
    throw error
  }
}

function writeUrlsData(scans: Error404UrlScan[]) {
  ensureDataDir()
  try {
    fs.writeFileSync(URLS_STORAGE_FILE, JSON.stringify(scans, null, 2))
  } catch (error) {
    console.error('Failed to write URLs history file:', error)
    throw error
  }
}

// Insérer une nouvelle entrée
export async function insertError404History(entry: Omit<Error404HistoryEntry, 'created_at'>) {
  const data = readData()
  
  const newEntry: Error404HistoryEntry = {
    ...entry,
    created_at: new Date().toISOString()
  }
  
  data.push(newEntry)
  writeData(data)
  
  console.log('✅ Historique enregistré (fichier JSON)')
}

// Enregistrer un scan URL-level (toutes les URLs 404/410 d'un scan)
export async function saveError404UrlsScan(scan: Error404UrlScan) {
  const scans = readUrlsData()
  // Remplacer si scan_id existe déjà
  const idx = scans.findIndex(s => s.scan_id === scan.scan_id)
  if (idx >= 0) {
    scans[idx] = scan
  } else {
    scans.push(scan)
  }
  writeUrlsData(scans)
  console.log(`✅ URLs 404/410 sauvegardées (scan ${scan.scan_id}, ${scan.entries.length} entrées)`) 
}

export interface DeltaItem {
  site: string
  path: string
}

export interface Error404DeltaResult {
  from_scan_id: string
  to_scan_id: string
  gained: DeltaItem[] // nouvelles 404/410
  lost: DeltaItem[]   // corrigées
  persisting: number  // nombre restant identique
  by_site: Array<{
    site: string
    gained: number
    lost: number
    persisting: number
  }>
}

export async function getError404Delta(params: { from?: string; to?: string }): Promise<Error404DeltaResult | null> {
  const scans = readUrlsData().sort((a, b) => new Date(a.scan_date).getTime() - new Date(b.scan_date).getTime())
  if (scans.length < 2) return null

  let toScan: Error404UrlScan | undefined
  let fromScan: Error404UrlScan | undefined

  if (params.to) {
    toScan = scans.find(s => s.scan_id === params.to)
  } else {
    toScan = scans[scans.length - 1]
  }
  if (!toScan) return null

  if (params.from) {
    fromScan = scans.find(s => s.scan_id === params.from)
  } else {
    // prendre le précédent chronologique
    const toIndex = scans.findIndex(s => s.scan_id === toScan!.scan_id)
    fromScan = scans[toIndex - 1]
  }
  if (!fromScan) return null

  const key = (e: Error404UrlEntry) => `${e.site}|${e.path}`
  const toSet = new Set(toScan.entries.map(key))
  const fromSet = new Set(fromScan.entries.map(key))

  const gainedKeys: string[] = []
  const lostKeys: string[] = []

  // gained: in to not in from
  for (const k of toSet) if (!fromSet.has(k)) gainedKeys.push(k)
  // lost: in from not in to
  for (const k of fromSet) if (!toSet.has(k)) lostKeys.push(k)

  const toItem = (k: string): DeltaItem => {
    const [site, path] = k.split('|')
    return { site, path }
  }

  // by_site summary
  const sites = new Set<string>([
    ...toScan.entries.map(e => e.site),
    ...fromScan.entries.map(e => e.site),
  ])
  const by_site = Array.from(sites).map(site => {
    const g = gainedKeys.filter(k => k.startsWith(site + '|')).length
    const l = lostKeys.filter(k => k.startsWith(site + '|')).length
    const pTo = toScan.entries.filter(e => e.site === site).length
    const pFrom = fromScan.entries.filter(e => e.site === site).length
    const persisting = Math.min(pTo, pFrom) - Math.max(0, g - l) // approx conservative
    return { site, gained: g, lost: l, persisting: Math.max(0, persisting) }
  })

  return {
    from_scan_id: fromScan.scan_id,
    to_scan_id: toScan.scan_id,
    gained: gainedKeys.map(toItem),
    lost: lostKeys.map(toItem),
    persisting: [...toSet].filter(k => fromSet.has(k)).length,
    by_site,
  }
}

// Récupérer l'évolution
export async function getError404Evolution(days: number = 30): Promise<Error404Evolution[]> {
  const data = readData()
  
  if (data.length === 0) {
    return []
  }
  
  // Filtrer par date
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  
  const filtered = data.filter(entry => {
    const scanDate = new Date(entry.scan_date)
    return scanDate >= cutoffDate
  })
  
  // Grouper par date (clé = YYYY-MM-DD)
  const groupedByDate = new Map<string, Error404HistoryEntry[]>()
  
  filtered.forEach(entry => {
    const date = entry.scan_date.split('T')[0] // YYYY-MM-DD
    if (!groupedByDate.has(date)) {
      groupedByDate.set(date, [])
    }
    groupedByDate.get(date)!.push(entry)
  })
  
  // Calculer les moyennes
  const result: Error404Evolution[] = []
  
  groupedByDate.forEach((entries, date) => {
    const totalErrors = entries.reduce((sum, e) => sum + e.total_errors_404, 0)
    const totalPages = entries.reduce((sum, e) => sum + e.total_pages_checked, 0)
    const totalDuration = entries.reduce((sum, e) => sum + e.crawl_duration_seconds, 0)
    const errors = entries.map(e => e.total_errors_404)
    
    result.push({
      // Uniformiser en ISO complet: minuit UTC de la journée agrégée
      date: `${date}T00:00:00.000Z`,
      nb_scans: entries.length,
      avg_pages_checked: totalPages / entries.length,
      avg_errors_404: totalErrors / entries.length,
      max_errors_404: Math.max(...errors),
      min_errors_404: Math.min(...errors),
      avg_duration_seconds: totalDuration / entries.length,
    })
  })
  
  // Trier par date décroissante
  return result.sort((a, b) => b.date.localeCompare(a.date))
}

// Récupérer le dernier scan
export async function getLastError404Scan(): Promise<Error404HistoryEntry | null> {
  const data = readData()
  
  if (data.length === 0) {
    return null
  }
  
  // Trier par date décroissante
  const sorted = data.sort((a, b) => 
    new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime()
  )
  
  return sorted[0]
}

export async function getLastReconstructedScan(): Promise<ReconstructedScanResponse | null> {
  const history = readData()
  if (history.length === 0) return null
  const last = [...history].sort((a, b) => new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime())[0]
  if (!last) return null

  // Lire les scans de liens cassés visibles
  let blScans: BrokenLinksScan[] = []
  try {
    if (fs.existsSync(BROKEN_LINKS_SCANS_FILE)) {
      blScans = JSON.parse(fs.readFileSync(BROKEN_LINKS_SCANS_FILE, 'utf-8')) as BrokenLinksScan[]
    }
  } catch {}
  const blForScan = blScans.find(s => s.scan_id === (last as any).id)

  const siteToBrokenLinks = new Map<string, Array<{ source: string; target: string }>>()
  if (blForScan) {
    for (const l of blForScan.links) {
      if (!siteToBrokenLinks.has(l.site)) siteToBrokenLinks.set(l.site, [])
      siteToBrokenLinks.get(l.site)!.push({ source: l.source, target: l.target })
    }
  }

  const results: ReconstructedSiteScan[] = last.sites_results.map(siteRow => {
    const links = siteToBrokenLinks.get(siteRow.site) || []
    return {
      site: siteRow.site,
      total_checked: siteRow.total_checked,
      errors_404: siteRow.errors_404,
      errors_list: [],
      broken_links: links.length,
      broken_links_list: links,
      scan_date: last.scan_date,
    }
  })

  return {
    scan_id: (last as any).id,
    scan_date: last.scan_date,
    results,
    summary: {
      total_sites: last.total_sites,
      total_checked: last.total_pages_checked,
      total_errors: last.total_errors_404,
    },
  }
}

// Derniers scans (non agrégés) mappés au format Evolution pour l'UI
export async function getLastScansAsEvolution(limit: number = 20): Promise<Error404Evolution[]> {
  const data = readData()
  if (data.length === 0) return []
  const sorted = [...data].sort((a, b) => new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime())
  const selected = sorted.slice(0, limit).reverse() // plus anciens d'abord
  return selected.map(s => ({
    // Conserver l'horodatage complet pour l'affichage dans le tooltip
    date: s.scan_date,
    nb_scans: 1,
    avg_pages_checked: s.total_pages_checked,
    avg_errors_404: s.total_errors_404,
    max_errors_404: s.total_errors_404,
    min_errors_404: s.total_errors_404,
    avg_duration_seconds: s.crawl_duration_seconds,
  }))
}

// Fichier séparé pour stocker les liens cassés persistants
const BROKEN_LINKS_FILE = path.join(process.cwd(), 'data', 'broken-links.json')
const BROKEN_LINKS_SCANS_FILE = path.join(process.cwd(), 'data', 'broken-links-scans.json')

// Lire les liens cassés persistants
export async function loadBrokenLinks(): Promise<SiteBrokenLinks[]> {
  ensureDataDir()
  
  if (!fs.existsSync(BROKEN_LINKS_FILE)) {
    return []
  }
  
  try {
    const content = fs.readFileSync(BROKEN_LINKS_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to read broken links file:', error)
    return []
  }
}

// Sauvegarder les liens cassés persistants
export async function saveBrokenLinks(linksBySite: SiteBrokenLinks[]) {
  ensureDataDir()
  
  try {
    fs.writeFileSync(BROKEN_LINKS_FILE, JSON.stringify(linksBySite, null, 2))
    console.log('✅ Liens cassés sauvegardés')
  } catch (error) {
    console.error('Failed to save broken links file:', error)
    throw error
  }
}

// ==============================
// Broken links per scan (for delta)
// ==============================

export interface BrokenLinksScanEntry {
  site: string
  source: string
  target: string
}

export interface BrokenLinksScan {
  scan_id: string
  scan_date: string
  commit_sha?: string
  branch?: string
  actor?: string
  repo?: string
  links: BrokenLinksScanEntry[]
}

function readBrokenLinksScans(): BrokenLinksScan[] {
  ensureDataDir()
  if (!fs.existsSync(BROKEN_LINKS_SCANS_FILE)) return []
  try {
    const content = fs.readFileSync(BROKEN_LINKS_SCANS_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (e) {
    console.error('Failed to read broken links scans file:', e)
    return []
  }
}

function writeBrokenLinksScans(scans: BrokenLinksScan[]) {
  ensureDataDir()
  try {
    fs.writeFileSync(BROKEN_LINKS_SCANS_FILE, JSON.stringify(scans, null, 2))
  } catch (e) {
    console.error('Failed to write broken links scans file:', e)
    throw e
  }
}

export async function saveBrokenLinksScan(scan: BrokenLinksScan) {
  const scans = readBrokenLinksScans()
  const idx = scans.findIndex(s => s.scan_id === scan.scan_id)
  if (idx >= 0) scans[idx] = scan
  else scans.push(scan)
  writeBrokenLinksScans(scans)
  console.log(`✅ Liens cassés visibles par scan sauvegardés (${scan.links.length})`)
}

export interface BrokenLinksDeltaItem {
  site: string
  path: string // target pathname (lien cassé visible)
}

export interface BrokenLinksDeltaResult {
  from_scan_id: string
  to_scan_id: string
  gained: BrokenLinksDeltaItem[]
  lost: BrokenLinksDeltaItem[]
  persisting: number
  by_site: Array<{ site: string; gained: number; lost: number; persisting: number }>
}

export async function getBrokenLinksDelta(params: { from?: string; to?: string }): Promise<BrokenLinksDeltaResult | null> {
  const scans = readBrokenLinksScans().sort((a, b) => new Date(a.scan_date).getTime() - new Date(b.scan_date).getTime())
  if (scans.length < 2) return null

  let toScan = params.to ? scans.find(s => s.scan_id === params.to) : scans[scans.length - 1]
  if (!toScan) return null
  let fromScan: BrokenLinksScan | undefined
  if (params.from) fromScan = scans.find(s => s.scan_id === params.from)
  else {
    const idx = scans.findIndex(s => s.scan_id === toScan!.scan_id)
    fromScan = scans[idx - 1]
  }
  if (!fromScan) return null

  const key = (e: BrokenLinksScanEntry) => `${e.site}|${e.source}|${e.target}`
  const toSet = new Set(toScan.links.map(key))
  const fromSet = new Set(fromScan.links.map(key))

  const gainedKeys: string[] = []
  const lostKeys: string[] = []
  for (const k of toSet) if (!fromSet.has(k)) gainedKeys.push(k)
  for (const k of fromSet) if (!toSet.has(k)) lostKeys.push(k)

  const toItem = (k: string): BrokenLinksDeltaItem => {
    const [site, , target] = k.split('|')
    const path = (() => { try { return new URL(target).pathname } catch { return target } })()
    return { site, path }
  }

  const sites = new Set<string>([...toScan.links.map(l => l.site), ...fromScan.links.map(l => l.site)])
  const by_site = Array.from(sites).map(site => {
    const g = gainedKeys.filter(k => k.startsWith(site + '|')).length
    const l = lostKeys.filter(k => k.startsWith(site + '|')).length
    const pTo = toScan.links.filter(e => e.site === site).length
    const pFrom = fromScan.links.filter(e => e.site === site).length
    const persisting = Math.min(pTo, pFrom) - Math.max(0, g - l)
    return { site, gained: g, lost: l, persisting: Math.max(0, persisting) }
  })

  return {
    from_scan_id: fromScan.scan_id,
    to_scan_id: toScan.scan_id,
    gained: gainedKeys.map(toItem),
    lost: lostKeys.map(toItem),
    persisting: [...toSet].filter(k => fromSet.has(k)).length,
    by_site,
  }
}

