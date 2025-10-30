import fs from 'fs'
import path from 'path'

const STORAGE_FILE = path.join(process.cwd(), 'data', 'errors-404-history.json')

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
  
  // Grouper par date
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
      date,
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

// Fichier séparé pour stocker les liens cassés persistants
const BROKEN_LINKS_FILE = path.join(process.cwd(), 'data', 'broken-links.json')

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

