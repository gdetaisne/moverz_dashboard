import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Mapping domaine -> ville (plus fiable que parsing)
const DOMAIN_TO_CITY: Record<string, string> = {
  'devis-demenageur-marseille.fr': 'marseille',
  'devis-demenageur-toulousain.fr': 'toulouse',
  'devis-demenageur-lyon.fr': 'lyon',
  'bordeaux-demenageur.fr': 'bordeaux',
  'devis-demenageur-nantes.fr': 'nantes',
  'devis-demenageur-lille.fr': 'lille',
  'devis-demenageur-nice.fr': 'nice',
  'devis-demenageur-strasbourg.fr': 'strasbourg',
  'devis-demenageur-rouen.fr': 'rouen',
  'devis-demenageur-rennes.fr': 'rennes',
  'devis-demenageur-montpellier.fr': 'montpellier',
}

// Helper pour obtenir les sites depuis SITES_LIST env
function getSitesFromEnv() {
  const sitesListEnv = process.env.SITES_LIST || ''
  const domains = sitesListEnv.split(',').map(s => s.trim()).filter(Boolean)
  
  // Fallback sur les sites par défaut si SITES_LIST n'est pas défini
  if (domains.length === 0) {
    domains.push(...Object.keys(DOMAIN_TO_CITY))
  }
  
  return domains.map((domain, idx) => ({
    id: String(idx + 1),
    domain,
    city: DOMAIN_TO_CITY[domain] || domain.split('.')[0].replace('devis-demenageur-', '').replace('bordeaux-demenageur', 'bordeaux'),
  }))
}

// Mapping domaine -> repo GitHub (pattern: gdetaisne/dd-{ville})
const DOMAIN_TO_REPO: Record<string, string> = {
  'devis-demenageur-marseille.fr': 'gdetaisne/dd-marseille',
  'devis-demenageur-toulousain.fr': 'gdetaisne/dd-toulouse',
  'devis-demenageur-lyon.fr': 'gdetaisne/dd-lyon',
  'bordeaux-demenageur.fr': 'gdetaisne/dd-bordeaux',
  'devis-demenageur-nantes.fr': 'gdetaisne/dd-nantes',
  'devis-demenageur-lille.fr': 'gdetaisne/dd-lille',
  'devis-demenageur-nice.fr': 'gdetaisne/dd-nice',
  'devis-demenageur-strasbourg.fr': 'gdetaisne/dd-strasbourg',
  'devis-demenageur-rouen.fr': 'gdetaisne/dd-rouen',
  'devis-demenageur-rennes.fr': 'gdetaisne/dd-rennes',
  'devis-demenageur-montpellier.fr': 'gdetaisne/dd-montpellier',
}

interface SiteVitals {
  domain: string
  city: string
  url: string
  lastCommit?: {
    sha: string
    date: string
    message: string
    author: string
  }
  health: {
    status: 'online' | 'offline' | 'error'
    statusCode?: number
    responseTime?: number // ms
    sslValid?: boolean
    error?: string
  }
}

/**
 * Health check HTTP simple
 */
async function checkHealth(url: string): Promise<SiteVitals['health']> {
  const startTime = Date.now()
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    // Vérifier SSL (simple: si HTTPS fonctionne, SSL probablement OK)
    const sslValid = url.startsWith('https://')
    
    return {
      status: response.ok ? 'online' : 'offline',
      statusCode: response.status,
      responseTime,
      sslValid,
    }
  } catch (error: any) {
    return {
      status: 'error',
      error: error.message || 'Unknown error',
      responseTime: Date.now() - startTime,
    }
  }
}

/**
 * Récupérer le dernier commit GitHub
 */
async function getLastCommit(repo: string): Promise<SiteVitals['lastCommit'] | null> {
  const githubToken = process.env.GITHUB_TOKEN
  
  try {
    const url = `https://api.github.com/repos/${repo}/commits?per_page=1`
    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
    }
    
    // Ajouter token si disponible (pour éviter rate limit)
    if (githubToken) {
      // Support format classique (token) et moderne (Bearer)
      headers.Authorization = githubToken.startsWith('ghp_') || githubToken.startsWith('github_pat_')
        ? `Bearer ${githubToken}`
        : `token ${githubToken}`
    }
    
    const response = await fetch(url, { headers })
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Repo ${repo} not found`)
        return null
      }
      throw new Error(`GitHub API error: ${response.status}`)
    }
    
    const commits: any[] = await response.json()
    
    if (commits.length === 0) {
      return null
    }
    
    const commit = commits[0]
    
    return {
      sha: commit.sha.substring(0, 7),
      date: commit.commit.author.date,
      message: commit.commit.message.split('\n')[0], // Première ligne seulement
      author: commit.commit.author.name,
    }
  } catch (error: any) {
    console.error(`Error fetching commit for ${repo}:`, error.message)
    return null
  }
}

/**
 * GET /api/vitals
 * Récupère les vitals de santé pour tous les sites
 */
export async function GET(request: NextRequest) {
  try {
    const sites = getSitesFromEnv()
    
    // Pour chaque site, récupérer les vitals en parallèle
    const vitalsPromises = sites.map(async (site): Promise<SiteVitals> => {
      const url = `https://${site.domain}`
      const repo = DOMAIN_TO_REPO[site.domain]
      
      // Health check et commit en parallèle
      const [health, lastCommit] = await Promise.all([
        checkHealth(url),
        repo ? getLastCommit(repo) : Promise.resolve(null),
      ])
      
      return {
        domain: site.domain,
        city: site.city,
        url,
        lastCommit: lastCommit || undefined,
        health,
      }
    })
    
    const vitals = await Promise.all(vitalsPromises)
    
    return NextResponse.json({
      success: true,
      data: vitals,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error fetching vitals:', error)
    
    return NextResponse.json(
      {
        success: false,
        message: 'Erreur lors de la récupération des vitals',
        error: error.message,
      },
      { status: 500 }
    )
  }
}

