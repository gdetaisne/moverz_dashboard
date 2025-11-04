"use client"

import { useEffect, useMemo, useState } from 'react'
import PageIntro from '@/components/PageIntro'
import Tooltip from '@/components/Tooltip'
import { CheckSquare, Copy, RefreshCw } from 'lucide-react'

type ChecklistItem = {
  id: string
  label: string
}

type ChecklistCategory = {
  id: string
  title: string
  max: number
  items: ChecklistItem[]
}

const CHECKLIST: ChecklistCategory[] = [
  {
    id: 'technique',
    title: 'SEO Technique (25)',
    max: 25,
    items: [
      // Crawl & Indexation
      { id: '1', label: 'Robots.txt présent et correct' },
      { id: '2', label: 'Sitemap XML présent, valide, soumis GSC' },
      { id: '3', label: 'Directive Sitemap dans robots.txt' },
      { id: '4', label: 'Pages indexables (site:domain.com)' },
      { id: '5', label: 'Noindex accidentel: aucune page importante' },
      { id: '6', label: 'Meta robots correctement configurés' },
      { id: '7', label: 'Balises canonical présentes et correctes' },
      { id: '8', label: 'Canonical self-reference' },
      { id: '9', label: 'Trailing slash cohérent' },
      { id: '10', label: 'Redirections 301 correctes' },
      // Structure Technique
      { id: '11', label: 'Site 100% HTTPS' },
      { id: '12', label: 'WWW vs non-WWW cohérent' },
      { id: '13', label: 'URLs propres et lisibles' },
      { id: '14', label: 'Pagination gérée (rel next/prev ou inf. scroll)' },
      { id: '15', label: 'Hreflang correct (si multilingue)' },
      { id: '16', label: '404 errors < 5% et page 404 personnalisée' },
      { id: '17', label: 'Pas de chaînes 301/302 (max 1 redirect)' },
      { id: '18', label: 'Pas de soft 404' },
      { id: '19', label: 'Réponses serveur 200 OK' },
      { id: '20', label: 'Sitemap: URLs indexables et 200 OK' },
      // Nouveaux tests
      { id: '101', label: 'HSTS (Strict-Transport-Security) présent' },
      { id: '103', label: 'Sitemap: balises <lastmod> présentes' },
      // Crawl Budget
      { id: '21', label: '0 erreurs de crawl dans GSC' },
      { id: '22', label: 'Paramètres d’URL gérés dans GSC' },
      { id: '23', label: 'Pas de contenu dupliqué (canonicals OK)' },
      { id: '24', label: 'Canonicals des pages paginées corrects' },
      { id: '25', label: 'Site vérifié et surveillé dans GSC' },
    ],
  },
  {
    id: 'onpage',
    title: 'SEO On-Page (25)',
    max: 25,
    items: [
      // Meta Tags
      { id: '26', label: 'Title tags présents et uniques' },
      { id: '27', label: 'Longueur title 50–60 caractères' },
      { id: '28', label: 'Mots-clés principaux en début de title' },
      { id: '29', label: 'Meta descriptions présentes et uniques' },
      { id: '30', label: 'Longueur description 150–160 caractères' },
      { id: '31', label: 'Meta keywords supprimées' },
      { id: '32', label: 'Open Graph complet (og:title, og:image, …)' },
      { id: '33', label: 'Twitter Cards configurées' },
      { id: '34', label: 'Favicon multi-tailles (16/32/180)' },
      { id: '35', label: 'Meta viewport pour mobile' },
      // Structure HTML
      { id: '36', label: 'H1 unique et descriptif' },
      { id: '37', label: 'Hiérarchie Hn logique' },
      { id: '38', label: 'Alt text descriptif pour toutes images' },
      { id: '39', label: 'Images optimisées (≤100KB, WebP/AVIF)' },
      { id: '40', label: 'Lazy loading des images' },
      { id: '41', label: 'Maillage interne cohérent (3–5 liens/page)' },
      { id: '42', label: 'Anchors descriptifs (pas "cliquez ici")' },
      { id: '43', label: 'Liens sortants vers sources fiables' },
      { id: '44', label: 'Nofollow pour sponsorisés/UGC' },
      { id: '45', label: '0 liens internes cassés' },
      // URL & Navigation
      { id: '46', label: 'Breadcrumbs présents' },
      { id: '47', label: 'Navigation claire (1 clic)' },
      { id: '48', label: 'Footer: liens utiles (contact, mentions, sitemap)' },
      { id: '49', label: 'Profondeur ≤ 3 clics depuis home' },
      { id: '50', label: 'Keywords pertinents dans les URLs' },
      // Nouveaux tests
      { id: '104', label: 'og:url cohérent avec canonical' },
    ],
  },
  {
    id: 'content',
    title: 'Contenu & Mots-Clés (15)',
    max: 15,
    items: [
      // Qualité Contenu
      { id: '51', label: 'Contenu 100% original' },
      { id: '52', label: 'Longueur adaptée (articles > 1000 mots si pertinent)' },
      { id: '53', label: 'Densité mots-clés naturelle (1–2%)' },
      { id: '54', label: 'Présence de synonymes/variantes (LSI)' },
      { id: '55', label: 'Contenu frais et à jour' },
      { id: '56', label: 'Multimedia (images/vidéos) pertinent' },
      { id: '57', label: 'Formatage lisible (paragraphes, listes, gras)' },
      { id: '58', label: 'CTA clairs et visibles' },
      { id: '59', label: 'E‑E‑A‑T démontrée' },
      { id: '60', label: 'Citations et sources fiables' },
      // Stratégie Mots-Clés
      { id: '61', label: 'Recherche mots-clés (volume, concurrence)' },
      { id: '62', label: 'Ciblage long‑tail' },
      { id: '63', label: 'Alignement avec l’intention de recherche' },
      { id: '64', label: 'Optimisé pour featured snippets' },
      { id: '65', label: 'FAQ structurée si pertinent' },
    ],
  },
  {
    id: 'performance',
    title: 'Performance & Core Web Vitals (10)',
    max: 10,
    items: [
      { id: '66', label: 'PageSpeed > 90' },
      { id: '67', label: 'LCP < 2.5s' },
      { id: '68', label: 'INP < 200ms' },
      { id: '69', label: 'CLS < 0.1' },
      { id: '70', label: 'TTFB < 600ms' },
      { id: '71', label: 'Compression Gzip/Brotli activée' },
      { id: '72', label: 'CSS/JS minifiés' },
      { id: '73', label: 'CDN pour assets statiques' },
      { id: '74', label: 'Headers de cache corrects' },
      { id: '75', label: 'Critical CSS inline pour first paint' },
      // Nouveaux tests
      { id: '102', label: 'CrUX (terrain): LCP/CLS/INP en vert' },
    ],
  },
  {
    id: 'mobile',
    title: 'Mobile & UX (10)',
    max: 10,
    items: [
      { id: '76', label: 'Responsive design (tous écrans)' },
      { id: '77', label: 'Test Mobile-Friendly réussi' },
      { id: '78', label: 'Cibles tactiles ≥ 48x48px' },
      { id: '79', label: 'Taille de police mobile ≥ 16px' },
      { id: '80', label: 'Pas de scroll horizontal' },
      { id: '81', label: 'Navigation mobile (burger) fonctionnelle' },
      { id: '82', label: 'Formulaires optimisés mobile' },
      { id: '83', label: 'Pas de pop-ups intrusifs' },
      { id: '84', label: 'Temps de chargement < 3s (4G)' },
      { id: '85', label: 'AMP si pertinent' },
    ],
  },
  {
    id: 'schema',
    title: 'Schema.org & Rich Snippets (5)',
    max: 5,
    items: [
      { id: '86', label: 'Schema.org présent (Organization, Article, …)' },
      { id: '87', label: 'Rich Results Test: 0 erreurs' },
      { id: '88', label: 'BreadcrumbList (schema) présent' },
      { id: '89', label: 'FAQPage si page FAQ' },
      { id: '90', label: 'AggregateRating si avis clients' },
    ],
  },
  {
    id: 'local',
    title: 'Local SEO (5)',
    max: 5,
    items: [
      { id: '91', label: 'Google My Business complet et vérifié' },
      { id: '92', label: 'NAP consistant partout' },
      { id: '93', label: 'LocalBusiness schema avec adresse/horaires' },
      { id: '94', label: 'Avis clients présents et réponses' },
      { id: '95', label: 'Citations locales (annuaires)' },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics & Suivi (5)',
    max: 5,
    items: [
      { id: '96', label: 'Google Analytics 4 installé' },
      { id: '97', label: 'Search Console reliée et exploitée' },
      { id: '98', label: 'Conversion tracking configuré' },
      { id: '99', label: 'Heatmaps (Hotjar, …) installé' },
      { id: '100', label: 'Monitoring & alertes en place' },
    ],
  },
]

// IDs de checks automatisables (détectables par fetch HTML/headers)
  const SIMPLE_AUTOMATABLE_IDS = new Set<string>([
  // Technique
  '1','2','3','5','6','7','8','9','10','11','12','13','15','19',
  // On-page
  '26','27','28','29','30','31','32','33','34','35','36','37','38','40','41','43','44','46','48',
  // Contenu
  '65',
  // Schema.org
  '86','88','89','90','87',
  // Analytics
    '96','97','99',
    // Nouveaux
    '101','102','103','104'
])

export default function SeoChecksPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [view, setView] = useState<'checklist' | 'matrix'>('checklist')
  const [sites, setSites] = useState<string[]>([])
  const [status, setStatus] = useState<Record<string, Record<string, 'na' | 'ok' | 'ko' | 'pending' | 'err'>>>({})
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [processedSites, setProcessedSites] = useState<number>(0)
  const [lastDoneAt, setLastDoneAt] = useState<number | null>(null)
  const [onlyDone, setOnlyDone] = useState<boolean>(false)

  useEffect(() => {
    let ignore = false
    fetch('/api/metrics/global?days=30')
      .then((r) => r.json())
      .then((json) => {
        if (ignore) return
        if (json?.data) {
          const list = (json.data as any[]).map((x) => x.site).filter(Boolean)
          setSites(list)
        }
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [])

  const totals = useMemo(() => {
    const perCategory = CHECKLIST.map((cat) => {
      const done = cat.items.reduce((acc, it) => acc + (checked[it.id] ? 1 : 0), 0)
      return { id: cat.id, title: cat.title, done, max: cat.items.length }
    })
    const totalDone = perCategory.reduce((a, c) => a + c.done, 0)
    const totalMax = perCategory.reduce((a, c) => a + c.max, 0)
    const score = Math.round((totalDone / totalMax) * 100)
    return { perCategory, totalDone, totalMax, score }
  }, [checked])

  function toggleAll(next: boolean) {
    const nextState: Record<string, boolean> = {}
    CHECKLIST.forEach((cat) => cat.items.forEach((it) => (nextState[it.id] = next)))
    setChecked(nextState)
  }

  // Aplatissement des 100 checks + indicateur d'automatisation (simple/complexe)
  const ALL_ITEMS = useMemo(() => CHECKLIST.flatMap((c) => c.items), [])
  const SIMPLE_IDS = useMemo(() => ALL_ITEMS.map((it) => it.id).filter((id) => SIMPLE_AUTOMATABLE_IDS.has(id)), [ALL_ITEMS])

  function isSimpleAutomatable(id: string): boolean {
    return SIMPLE_AUTOMATABLE_IDS.has(id)
  }

  function getDescription(id: string): string {
    const map: Record<string, string> = {
      '1': 'Vérifie /robots.txt (200) et présence de la directive User-agent.',
      '2': 'Vérifie /sitemap.xml (200) et une balise <urlset> ou <sitemapindex>.',
      '3': 'Cherche une ligne Sitemap: https://… dans robots.txt.',
      '5': 'Analyse <meta name="robots"> sur la home; échoue si noindex/nofollow.',
      '6': 'Vérifie que meta robots contient index et follow (ou est absent).',
      '7': 'Vérifie la présence d’un <link rel="canonical">.',
      '8': 'Compare canonical et URL finale (même host + même path).',
      '9': 'Compare le trailing slash entre canonical et URL finale.',
      '10': 'Teste redirection http → https (301/308 ou redirected=true).',
      '11': 'Teste que la home HTTPS répond (status 2xx/3xx).',
      '12': 'Teste que www et non‑www redirigent de façon cohérente.',
      '13': 'Vérifie que l’URL finale de home n’a pas de query string.',
      '15': 'Si présent: <link rel="alternate" hreflang="xx-YY"> a un format valide.',
      '19': 'La home renvoie un status 200.',
      '26': 'Présence d’un <title>.',
      '27': 'Longueur du title entre 50 et 60 caractères.',
      '29': 'Présence de <meta name="description">.',
      '30': 'Longueur de la description entre 150 et 160 caractères.',
      '31': 'Absence de <meta name="keywords">.',
      '32': 'Open Graph de base: og:title et og:image présents.',
      '33': 'Présence de <meta name="twitter:card">.',
      '34': 'Présence d’un lien favicon (<link rel="icon">).',
      '35': 'Présence de <meta name="viewport">.',
      '36': 'Exactement un <h1> sur la page.',
      '38': 'Toutes les <img> ont un attribut alt non vide.',
      '40': 'Au moins une image avec loading="lazy".',
      '41': '≥ 3 liens internes (même domaine) sur la home.',
      '43': '≥ 1 lien externe (domaine différent).',
      '46': 'Breadcrumb via JSON‑LD BreadcrumbList ou <nav aria-label="breadcrumb">.',
      '48': 'Au moins un lien dans le footer.',
      '86': 'Présence d’au moins un bloc JSON‑LD.',
      '88': 'JSON‑LD avec @type="BreadcrumbList".',
      '89': 'JSON‑LD avec @type="FAQPage".',
      '90': 'JSON‑LD contenant aggregateRating / Review / Product.',
      '96': 'Détection GA4 (script gtag G-… ou gtag("config","G-…")).',
      '97': 'Présence de <meta name="google-site-verification">.',
      '99': 'Détection Hotjar (script src ou init inline).',
      '101': 'Vérifie l’en-tête Strict-Transport-Security sur la home (HTTPS).',
      '102': 'CrUX (terrain): LCP<2.5s, CLS<0.1, INP<200ms (percentile).',
      '103': 'Analyse sitemap.xml: présence de <lastmod> sur la majorité des URLs.',
      '104': 'Compare og:url et canonical (même host + path).',
    }
    return map[id] || 'Contrôle non automatisé ici (nécessite API/crawl/heuristiques).'
  }

  async function refreshSimpleChecks() {
    setRefreshing(true)
    setProcessedSites(0)
    setLastDoneAt(null)
    // Marque toutes les cellules automatisables en pending
    const pendingState = { ...status }
    for (const item of ALL_ITEMS) {
      if (!isSimpleAutomatable(item.id)) continue
      for (const site of sites) {
        pendingState[item.id] = pendingState[item.id] || {}
        pendingState[item.id][site] = 'pending'
      }
    }
    setStatus(pendingState)

    // Appels batch par site (beaucoup moins de requêtes)
    const COMPLEX_AUTO_IDS = ['66','67','68','69','70','71','72','74']
    const simpleIds = ALL_ITEMS
      .map((it) => it.id)
      .filter((id) => SIMPLE_AUTOMATABLE_IDS.has(id) || COMPLEX_AUTO_IDS.includes(id))
    await Promise.all(
      sites.map(async (site) => {
        try {
          const res = await fetch('/api/seo/check/batch', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ site, ids: simpleIds }),
          })
          if (!res.ok) throw new Error('batch failed')
          const json = await res.json()
          const results: Record<string, boolean | null> = json.results || {}
          setStatus((prev) => {
            const next = { ...prev }
            for (const id of simpleIds) {
              const v = results[id]
              const cell: 'ok' | 'ko' | 'na' = v === null ? 'na' : v ? 'ok' : 'ko'
              next[id] = next[id] || {}
              next[id][site] = cell
            }
            return next
          })
        } catch {
          setStatus((prev) => {
            const next = { ...prev }
            for (const id of simpleIds) {
              next[id] = next[id] || {}
              next[id][site] = 'err'
            }
            return next
          })
        } finally {
          setProcessedSites((n) => n + 1)
        }
      })
    )
    setRefreshing(false)
    setLastDoneAt(Date.now())
  }

  function exportMatrixCSV() {
    if (refreshing) {
      alert('Des tests sont encore en cours. Patientez quelques secondes, puis réessayez.')
      return
    }
    // Bloquer si des cellules sont "pending" (utilisateur a cliqué trop tôt)
    const hasPending = sites.some((s) =>
      ALL_ITEMS.some((it) => status[it.id]?.[s] === 'pending')
    )
    if (hasPending) {
      alert('Certains tests sont encore en cours (⏳). Veuillez actualiser et attendre la fin avant d\'exporter.')
      return
    }
    // Construire CSV: uniquement lignes avec au moins un résultat (ok/ko/na) pour un site
    const headers = ['#', 'Check', 'Auto', ...sites]
    let csv = headers.join(',') + '\n'
    const valueOf = (id: string, site: string): string => {
      const v = status[id]?.[site]
      if (v === 'ok') return 'OK'
      if (v === 'ko') return 'KO'
      if (v === 'na') return 'NA'
      if (v === 'err') return 'ERR'
      return ''
    }
    for (const it of ALL_ITEMS) {
      // inclure uniquement si au moins un site a un résultat
      const hasAny = sites.some((s) => {
        const v = status[it.id]?.[s]
        return v === 'ok' || v === 'ko' || v === 'na' || v === 'err'
      })
      if (!hasAny) continue
      const row = [
        it.id,
        '"' + (it.label || '').replace(/"/g, '""') + '"',
        isSimpleAutomatable(it.id) ? 'Simple' : 'Complexe',
        ...sites.map((s) => valueOf(it.id, s))
      ]
      csv += row.join(',') + '\n'
    }
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    const date = new Date().toISOString().slice(0,10)
    link.setAttribute('download', `seo-checks-${date}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function simplifyDomainLabel(site: string): string {
    try {
      const host = site.replace(/^https?:\/\//, '').replace(/^www\./, '')
      // Patterns connus
      const m1 = host.match(/^devis-demenageur-([a-z-]+)/i)
      if (m1) return capitalizeWords(m1[1].replace(/-/g, ' '))
      const m2 = host.match(/^([a-z-]+)-demenageur\./i)
      if (m2) return capitalizeWords(m2[1].replace(/-/g, ' '))
      // Fallback: sous-domaine principal
      const raw = host.split('.')[0]
      return capitalizeWords(raw.replace(/-/g, ' '))
    } catch { return site }
  }

  function capitalizeWords(s: string): string {
    return s.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function exportReportMarkdown() {
    const lines: string[] = []
    lines.push('# Audit SEO - [NOM SITE]')
    lines.push('')
    lines.push(`**Date** : ${new Date().toISOString().slice(0, 10)}`)
    lines.push('**Auditeur** : Guillaume')
    lines.push('**URL** : [URL]')
    lines.push('')
    lines.push(`## Score Global : ${totals.score}/100`)
    lines.push('')
    lines.push('### Répartition par Catégorie')
    lines.push('')
    totals.perCategory.forEach((c) => {
      const pct = Math.round((c.done / c.max) * parseInt(c.title.match(/\((\d+)\)/)?.[1] || String(c.max)))
      const titleClean = c.title.replace(/ \(\d+\)$/,'')
      lines.push(`- ${titleClean} : ${pct}/${c.title.match(/\((\d+)\)/)?.[1] || c.max}`)
    })
    lines.push('')
    lines.push('### 🔴 Points Critiques (Urgents)')
    lines.push('1. [Point critique 1]')
    lines.push('2. [Point critique 2]')
    lines.push('3. [Point critique 3]')
    lines.push('')
    lines.push('### 🟠 Points à Améliorer (Importants)')
    lines.push('1. [Point 1]')
    lines.push('2. [Point 2]')
    lines.push('3. [Point 3]')
    lines.push('')
    lines.push('### 🟢 Points Forts')
    lines.push('1. [Point fort 1]')
    lines.push('2. [Point fort 2]')
    lines.push('3. [Point fort 3]')
    lines.push('')
    lines.push('### 📋 Plan d\'Action')
    lines.push('#### Priorité 1 (Cette semaine)')
    lines.push('- [ ] Action 1')
    lines.push('- [ ] Action 2')
    lines.push('')
    lines.push('#### Priorité 2 (Ce mois)')
    lines.push('- [ ] Action 1')
    lines.push('- [ ] Action 2')
    lines.push('')
    lines.push('#### Priorité 3 (Long terme)')
    lines.push('- [ ] Action 1')
    lines.push('- [ ] Action 2')
    const markdown = lines.join('\n')

    navigator.clipboard.writeText(markdown).then(() => {
      alert('Template rapport copié dans le presse‑papiers.')
    }).catch(() => {
      alert('Impossible de copier. Sélectionnez et copiez manuellement.')
    })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-6 w-6 text-emerald-600" />
        <h1 className="text-2xl font-semibold">SEO checks – Checklist 100 points</h1>
      </div>

      <PageIntro
        finalite="Exécuter une checklist SEO complète et calculer un score global."
        tableaux={[
          'Checklist interactive (100 points)',
          'Score global et par catégorie',
          'Export du template rapport (Markdown)'
        ]}
        sources={[
          'Bonnes pratiques Google Search Central',
          'Web.dev, Schema.org, GSC'
        ]}
      />

      {/* Header actions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded border border-gray-300 overflow-hidden">
          <button
            onClick={() => setView('checklist')}
            className={'text-sm px-3 py-1 ' + (view === 'checklist' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50')}
            title="Vue checklist"
          >
            Checklist
          </button>
          <button
            onClick={() => setView('matrix')}
            className={'text-sm px-3 py-1 border-l border-gray-300 ' + (view === 'matrix' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50')}
            title="Vue tableau multi-sites"
          >
            Tableau multi‑sites
          </button>
        </div>
        <button
          onClick={() => toggleAll(true)}
          className="text-sm px-3 py-1 rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        >
          Tout cocher
        </button>
        <button
          onClick={() => toggleAll(false)}
          className="text-sm px-3 py-1 rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        >
          Tout décocher
        </button>
        <button
          onClick={exportReportMarkdown}
          className="text-sm px-3 py-1 rounded border bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 inline-flex items-center gap-1"
          title="Copier le template de rapport (Markdown)"
        >
          <Copy className="h-4 w-4" /> Copier le template
        </button>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-sm">
            <span className="font-semibold">Score</span> : {totals.score}/100
          </div>
          <div className="text-xs text-slate-600">
            {totals.totalDone}/{totals.totalMax} checks
          </div>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="text-xs px-2 py-1 rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1"
            title="Haut de page"
          >
            <RefreshCw className="h-3 w-3" />
            Haut
          </button>
        </div>
      </div>

      {view === 'checklist' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {CHECKLIST.map((category) => (
            <div key={category.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{category.title}</h2>
                <span className="text-sm text-slate-600">
                  {category.items.reduce((acc, it) => acc + (checked[it.id] ? 1 : 0), 0)}/{category.items.length}
                </span>
              </div>
              <ul className="space-y-2">
                {category.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <input
                      id={`itm-${item.id}`}
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={!!checked[item.id]}
                      onChange={(e) => setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                    />
                  <label htmlFor={`itm-${item.id}`} className="text-sm cursor-pointer select-none">
                    <span className="font-semibold">{item.id}.</span> {item.label}{' '}
                    <Tooltip content={<div className="text-xs text-slate-700">{getDescription(item.id)}</div>}>
                      <span className="ml-1 inline-block text-slate-400 hover:text-slate-600 cursor-help" aria-label="Aide">(?)</span>
                    </Tooltip>
                  </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {view === 'matrix' && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-600">
              {sites.length} sites • {ALL_ITEMS.length} checks • Automatisables: {SIMPLE_IDS.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOnlyDone((v) => !v)}
                className={
                  'text-sm px-3 py-1 rounded border ' +
                  (onlyDone
                    ? 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')
                }
                title={onlyDone ? 'Afficher tous les tests' : 'Cacher les tests non réalisés'}
              >
                {onlyDone ? 'Afficher tout' : 'Simplifier'}
              </button>
              <button
                onClick={refreshSimpleChecks}
                className="text-sm px-3 py-1 rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-60"
                title="Lancer les tests automatisables"
                disabled={refreshing}
              >
                {refreshing ? 'Actualisation…' : 'Actualiser'}
              </button>
              <button
                onClick={exportMatrixCSV}
                className="text-sm px-3 py-1 rounded border bg-green-600 text-white border-green-700 hover:bg-green-700 disabled:opacity-60"
                title="Exporter uniquement les tests réalisés (OK/KO/NA)"
                disabled={refreshing}
              >
                Exporter CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4 whitespace-nowrap">#</th>
                  <th className="py-2 pr-4">Check</th>
                  <th className="py-2 pr-4 whitespace-nowrap">Auto</th>
                  {sites.map((s) => (
                    <th key={s} className="py-2 px-2 align-bottom">
                      <div className="h-20 w-16 relative" title={s}>
                        <div className="absolute bottom-0 left-0 origin-bottom-left -rotate-45 whitespace-nowrap text-[12px] font-medium text-slate-700">
                          {simplifyDomainLabel(s)}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="border-b bg-slate-50">
                  <th className="py-1 pr-4"></th>
                  <th className="py-1 pr-4 text-xs text-slate-600">Score (auto)</th>
                  <th className="py-1 pr-4 text-xs text-slate-600">
                    {refreshing ? (
                      <span>En cours… {processedSites}/{sites.length} sites</span>
                    ) : (
                      <span>
                        {lastDoneAt ? (
                          <span>Terminé ✓</span>
                        ) : (
                          <span>—</span>
                        )}
                      </span>
                    )}
                  </th>
                  {sites.map((s) => {
                    let ok = 0
                    for (const id of SIMPLE_IDS) {
                      if (status[id]?.[s] === 'ok') ok++
                    }
                    return (
                      <th key={`score-${s}`} className="py-1 px-2 text-center text-xs font-semibold text-slate-700">
                        {ok}/{SIMPLE_IDS.length}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {(onlyDone
                  ? ALL_ITEMS.filter((it) => sites.some((s) => {
                      const v = status[it.id]?.[s]
                      return v === 'ok' || v === 'ko' || v === 'na'
                    }))
                  : ALL_ITEMS
                ).map((it) => (
                  <tr key={it.id} className="border-b align-top">
                    <td className="py-2 pr-4 text-slate-500 whitespace-nowrap">{it.id}</td>
                    <td className="py-2 pr-4">
                      {it.label}{' '}
                      <Tooltip content={<div className="text-xs text-slate-700">{getDescription(it.id)}</div>}>
                        <span className="ml-1 inline-block text-slate-400 hover:text-slate-600 cursor-help" aria-label="Aide">(?)</span>
                      </Tooltip>
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <span className={'px-2 py-0.5 rounded text-xs ' + (isSimpleAutomatable(it.id) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                        {isSimpleAutomatable(it.id) ? 'Simple' : 'Complexe'}
                      </span>
                    </td>
                    {sites.map((s) => {
                      const st = status[it.id]?.[s] || 'na'
                      return (
                        <td key={s} className="py-2 px-2 whitespace-nowrap text-center">
                          {st === 'pending' && (
                            <span className="inline-flex items-center justify-center text-base">⏳</span>
                          )}
                          {st === 'ok' && (
                            <span className="inline-flex items-center justify-center rounded px-1 text-base bg-green-100 text-green-700">✅</span>
                          )}
                          {st === 'ko' && (
                            <span className="inline-flex items-center justify-center rounded px-1 text-base bg-red-100 text-red-700">❌</span>
                          )}
                          {st === 'err' && (
                            <span className="inline-flex items-center justify-center rounded px-1 text-base bg-yellow-100 text-yellow-700" title="Erreur lors du test">⚠️</span>
                          )}
                          {st === 'na' && (
                            <span className="inline-flex items-center justify-center text-base text-slate-400">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Note: le bouton &quot;Actualiser&quot; déclenche une route stub pour l’instant. Je peux implémenter des tests concrets pour les checks marqués &quot;Simple&quot; (fetch HTML/headers, parsing).
          </div>
        </div>
      )}
    </div>
  )
}


