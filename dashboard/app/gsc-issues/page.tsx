'use client'

import { useState, useEffect } from 'react'
import PageIntro from '@/components/PageIntro'
import { 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  RefreshCw, 
  ExternalLink,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  FileText,
  Lightbulb,
  AlertCircle as AlertCircleIcon,
  Sparkles,
  Copy
} from 'lucide-react'
import { formatNumber } from '@/lib/utils'

interface GSCIssue {
  id: string
  issue_date: string
  domain: string
  issue_type: string
  severity: 'error' | 'warning' | 'info'
  status: 'open' | 'resolved' | 'fixed'
  title: string
  description: string | null
  affected_pages_count: number
  affected_urls: string[]
  detected_at: string
  first_seen: string | null
  last_seen: string | null
  resolved_at: string | null
  gsc_notification_id: string | null
  source: string
}

interface IssuesStats {
  total: number
  by_severity: {
    error: number
    warning: number
    info: number
  }
  by_status: {
    open: number
    resolved: number
    fixed: number
  }
  by_type: Record<string, number>
}

export default function GSCIssuesPage() {
  const [issues, setIssues] = useState<GSCIssue[]>([])
  const [stats, setStats] = useState<IssuesStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterDomain, setFilterDomain] = useState<string>('all')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('open')
  const [selectedIssue, setSelectedIssue] = useState<GSCIssue | null>(null)
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set())
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<{ success: boolean; message: string } | null>(null)
  const [latestInsight, setLatestInsight] = useState<any>(null)
  const [loadingInsight, setLoadingInsight] = useState(false)

  const domains = Array.from(new Set(issues.map(i => i.domain))).sort()

  function toggleExpand(issueId: string) {
    const newExpanded = new Set(expandedIssues)
    if (newExpanded.has(issueId)) {
      newExpanded.delete(issueId)
    } else {
      newExpanded.add(issueId)
    }
    setExpandedIssues(newExpanded)
  }

  async function runAnalysis() {
    if (analyzing) return

    setAnalyzing(true)
    setAnalysisResult(null)

    try {
      const response = await fetch('/api/agents/gsc-issues-analyzer/run', {
        method: 'POST',
      })

      const result = await response.json()

      if (result.success) {
        setAnalysisResult({
          success: true,
          message: 'Analyse terminée avec succès !',
        })
        // Charger le dernier insight après un court délai
        setTimeout(() => {
          fetchLatestInsight()
          fetchIssues()
        }, 3000)
      } else {
        setAnalysisResult({
          success: false,
          message: result.message || 'Erreur lors de l\'analyse',
        })
      }
    } catch (error) {
      console.error('Failed to run analysis:', error)
      setAnalysisResult({
        success: false,
        message: 'Erreur lors du lancement de l\'analyse',
      })
    } finally {
      setAnalyzing(false)
    }
  }

  async function fetchLatestInsight() {
    setLoadingInsight(true)
    try {
      const response = await fetch('/api/insights?agent=gsc-issues-analyzer&days=1&limit=1')
      const data = await response.json()
      if (data.insights && data.insights.length > 0) {
        setLatestInsight(data.insights[0])
      }
    } catch (error) {
      console.error('Failed to fetch latest insight:', error)
    } finally {
      setLoadingInsight(false)
    }
  }

  function exportToCursor() {
    if (!latestInsight || !latestInsight.evidence?.grouped_by_type) return

    const grouped = latestInsight.evidence.grouped_by_type
    let markdown = `# Analyse des problèmes GSC - ${new Date(latestInsight.created_at).toLocaleDateString('fr-FR')}\n\n`
    markdown += `${latestInsight.summary}\n\n`
    markdown += `## Regroupement par type de problème\n\n`

    Object.entries(grouped).forEach(([type, data]: [string, any]) => {
      markdown += `### Type: ${type}\n\n`
      markdown += `- **Total issues**: ${data.total_count}\n`
      markdown += `- **Pages affectées**: ${data.total_pages_affected}\n`
      markdown += `- **Domaines**: ${data.domains_affected.join(', ')}\n`
      markdown += `- **Priorité**: ${data.priority}\n\n`
      
      if (data.common_causes && data.common_causes.length > 0) {
        markdown += `**Causes communes:**\n`
        data.common_causes.forEach((cause: string) => {
          markdown += `- ${cause}\n`
        })
        markdown += `\n`
      }

      markdown += `**Correction technique:**\n`
      markdown += `${data.technical_fix}\n\n`

      if (data.code_examples && data.code_examples.length > 0) {
        markdown += `**Exemples de code:**\n`
        data.code_examples.forEach((example: string) => {
          markdown += `\`\`\`\n${example}\n\`\`\`\n\n`
        })
      }

      if (data.files_to_modify && data.files_to_modify.length > 0) {
        markdown += `**Fichiers à modifier:**\n`
        data.files_to_modify.forEach((file: string) => {
          markdown += `- ${file}\n`
        })
        markdown += `\n`
      }

      markdown += `---\n\n`
    })

    markdown += `## Actions prioritaires\n\n`
    if (latestInsight.suggested_actions && latestInsight.suggested_actions.length > 0) {
      latestInsight.suggested_actions.forEach((action: any, idx: number) => {
        markdown += `### ${idx + 1}. ${action.title}\n\n`
        markdown += `- **Type**: ${action.type}\n`
        markdown += `- **Site**: ${action.site}\n`
        markdown += `- **Priorité**: ${action.priority}\n`
        markdown += `- **Effort**: ${action.effort || 'medium'}\n\n`
        markdown += `**Détails techniques:**\n${action.impact}\n\n`
      })
    }

    // Copier dans le presse-papier
    navigator.clipboard.writeText(markdown).then(() => {
      alert('✅ Analyse copiée dans le presse-papier !\n\nCollez-la dans Cursor pour commencer les corrections.')
    }).catch(err => {
      console.error('Failed to copy:', err)
      // Fallback : ouvrir dans une nouvelle fenêtre
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gsc-issues-analysis-${new Date().toISOString().split('T')[0]}.md`
      a.click()
    })
  }

  async function fetchIssues() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        domain: filterDomain,
        severity: filterSeverity,
        status: filterStatus,
        days: '30',
      })

      const response = await fetch(`/api/gsc/issues?${params}`)
      const data = await response.json()

      if (data.success) {
        setIssues(data.issues || [])
        setStats(data.stats || null)
      } else {
        console.error('Error fetching issues:', data.message || data.error)
        setIssues([])
        setStats(null)
      }
    } catch (error) {
      console.error('Error fetching issues:', error)
      setIssues([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIssues()
    fetchLatestInsight()
  }, [filterDomain, filterSeverity, filterStatus])

  function getSeverityIcon(severity: string) {
    switch (severity) {
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-orange-600" />
      default:
        return <Info className="h-5 w-5 text-blue-600" />
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'resolved':
      case 'fixed':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
            Résolu
          </span>
        )
      case 'open':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
            Ouvert
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        finalite="Mesurer et analyser les problèmes d'indexation et alertes détectés par Google Search Console."
        tableaux={["Liste des issues GSC", "Statistiques par type", "Détails par domaine"]}
        sources={["BigQuery (table gsc_issues)", "Google Search Console API"]}
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Erreurs</div>
            <div className="text-2xl font-bold text-red-600">{stats.by_severity.error}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Avertissements</div>
            <div className="text-2xl font-bold text-orange-600">{stats.by_severity.warning}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Ouverts</div>
            <div className="text-2xl font-bold">{stats.by_status.open}</div>
          </div>
        </div>
      )}

      {/* Résultat de l'analyse */}
      {analysisResult && (
        <div className={`rounded-lg border-2 p-4 ${
          analysisResult.success
            ? 'bg-green-50 border-green-300'
            : 'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-center gap-2">
            {analysisResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <div className="flex-1">
              <div className={`font-medium ${analysisResult.success ? 'text-green-900' : 'text-red-900'}`}>
                {analysisResult.message}
              </div>
              {analysisResult.success && (
                <div className="text-sm text-green-700 mt-1">
                  Consultez la page <a href="/insights?agent=gsc-issues-analyzer" className="underline font-medium">Insights IA</a> pour voir les résultats détaillés.
                </div>
              )}
            </div>
            <button
              onClick={() => setAnalysisResult(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Filtres:</span>
          </div>
          
          <select
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="all">Tous les sites</option>
            {domains.map(domain => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="all">Toutes sévérités</option>
            <option value="error">Erreurs</option>
            <option value="warning">Avertissements</option>
            <option value="info">Info</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="all">Tous statuts</option>
            <option value="open">Ouverts</option>
            <option value="resolved">Résolus</option>
            <option value="fixed">Corrigés</option>
          </select>

          <button
            onClick={fetchIssues}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>

          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="ml-2 px-4 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Lancer l'analyse IA des problèmes d'indexation"
          >
            <Sparkles className={`h-4 w-4 ${analyzing ? 'animate-pulse' : ''}`} />
            {analyzing ? 'Analyse en cours...' : 'Analyser avec IA'}
          </button>

          {latestInsight && latestInsight.evidence?.grouped_by_type && (
            <button
              onClick={exportToCursor}
              className="ml-2 px-4 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center gap-2"
              title="Exporter l'analyse pour Cursor (copie dans le presse-papier)"
            >
              <Copy className="h-4 w-4" />
              Exporter pour Cursor
            </button>
          )}
        </div>
      </div>

      {/* Affichage du dernier insight */}
      {latestInsight && latestInsight.evidence?.grouped_by_type && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Dernière analyse IA disponible
              </h3>
              <p className="text-sm text-blue-800 mb-3">{latestInsight.summary}</p>
              <div className="text-sm text-blue-700">
                <strong>Problèmes regroupés par type:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {Object.entries(latestInsight.evidence.grouped_by_type).map(([type, data]: [string, any]) => (
                    <li key={type}>
                      <strong>{type}</strong>: {data.total_count} issues sur {data.domains_affected.length} domaines
                      {data.priority && ` (Priorité: ${data.priority})`}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              onClick={exportToCursor}
              className="ml-4 px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center gap-2 whitespace-nowrap"
            >
              <Copy className="h-4 w-4" />
              Copier pour Cursor
            </button>
          </div>
        </div>
      )}

      {/* Issues List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : issues.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-600" />
            <p>Aucune alerte trouvée pour les filtres sélectionnés</p>
          </div>
        ) : (
          <div className="divide-y">
            {issues.map(issue => {
              const isExpanded = expandedIssues.has(issue.id)
              return (
                <div
                  key={issue.id}
                  className="p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(issue.severity)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">{issue.title}</h3>
                        {getStatusBadge(issue.status)}
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">{issue.domain}</span>
                        {' · '}
                        <span className="capitalize">{issue.issue_type}</span>
                        {' · '}
                        <span>{issue.affected_pages_count} page{issue.affected_pages_count > 1 ? 's' : ''} affectée{issue.affected_pages_count > 1 ? 's' : ''}</span>
                      </div>

                      {issue.description && (
                        <div className="text-sm text-gray-700 mb-2 p-2 bg-gray-50 rounded whitespace-pre-line font-mono text-xs">
                          {issue.description}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-400 mb-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Détecté le {new Date(issue.detected_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                        {issue.first_seen && issue.first_seen !== issue.detected_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Première détection: {new Date(issue.first_seen).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                        {issue.resolved_at && (
                          <span className="text-green-600">
                            ✓ Résolu le {new Date(issue.resolved_at).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>

                      {/* Détails dépliables */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t space-y-3">
                          {/* URLs affectées */}
                          {issue.affected_urls && issue.affected_urls.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700">
                                <FileText className="h-4 w-4" />
                                Pages affectées ({issue.affected_urls.length})
                              </div>
                              <div className="space-y-1 max-h-40 overflow-y-auto bg-gray-50 rounded p-2">
                                {issue.affected_urls.slice(0, 10).map((url, idx) => {
                                  const fullUrl = url.startsWith('http') ? url : `https://${issue.domain}${url}`
                                  return (
                                    <div key={idx} className="text-xs">
                                      <a
                                        href={fullUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 break-all"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {url.length > 80 ? `${url.substring(0, 80)}...` : url}
                                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                      </a>
                                    </div>
                                  )
                                })}
                                {issue.affected_urls.length > 10 && (
                                  <div className="text-xs text-gray-500 italic pt-1">
                                    +{issue.affected_urls.length - 10} autre{issue.affected_urls.length - 10 > 1 ? 's' : ''} page{issue.affected_urls.length - 10 > 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Description détaillée */}
                          {issue.description && (
                            <div className="p-2 bg-blue-50 rounded border border-blue-200">
                              <div className="flex items-center gap-2 mb-1 text-xs font-medium text-blue-900">
                                <AlertCircleIcon className="h-3 w-3" />
                                Détails techniques
                              </div>
                              <div className="text-xs text-gray-700 whitespace-pre-line font-mono">
                                {issue.description}
                              </div>
                            </div>
                          )}

                          {/* Métadonnées */}
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-gray-500">Source:</span>
                              <span className="ml-1 font-medium capitalize">{issue.source}</span>
                            </div>
                            {issue.last_seen && (
                              <div>
                                <span className="text-gray-500">Dernière détection:</span>
                                <span className="ml-1 font-medium">
                                  {new Date(issue.last_seen).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                            )}
                            {issue.gsc_notification_id && (
                              <div className="col-span-2">
                                <span className="text-gray-500">ID Notification GSC:</span>
                                <span className="ml-1 font-mono text-xs">{issue.gsc_notification_id}</span>
                              </div>
                            )}
                          </div>

                          {/* Recommandations d'action */}
                          <div className="p-2 bg-yellow-50 rounded border border-yellow-200">
                            <div className="flex items-center gap-2 mb-1 text-xs font-medium text-yellow-900">
                              <Lightbulb className="h-3 w-3" />
                              Actions recommandées
                            </div>
                            <ul className="text-xs text-gray-700 space-y-1 ml-4 list-disc">
                              {issue.severity === 'error' && (
                                <>
                                  <li>Vérifier que l'URL est accessible et ne retourne pas d'erreur 404</li>
                                  <li>Vérifier le fichier robots.txt pour s'assurer que l'URL n'est pas bloquée</li>
                                  <li>Utiliser l'outil URL Inspection de GSC pour demander un nouveau crawl</li>
                                </>
                              )}
                              {issue.severity === 'warning' && issue.issue_type === 'indexing' && (
                                <>
                                  <li>Vérifier les balises meta robots sur la page</li>
                                  <li>Vérifier si une redirection existe vers une autre URL</li>
                                  <li>Vérifier les règles de robots.txt qui pourraient exclure la page</li>
                                </>
                              )}
                              {(issue.issue_type === 'coverage' || issue.description?.includes('EXCLUDED')) && (
                                <>
                                  <li>Vérifier les règles d'exclusion dans robots.txt</li>
                                  <li>Vérifier les balises meta noindex sur la page</li>
                                  <li>Vérifier le fichier sitemap.xml</li>
                                </>
                              )}
                            </ul>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedIssue(issue)
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            Voir tous les détails
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpand(issue.id)
                        }}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title={isExpanded ? "Réduire" : "Développer"}
                      >
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedIssue(issue)
                        }}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        title="Voir détails complets"
                      >
                        <ExternalLink className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedIssue(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getSeverityIcon(selectedIssue.severity)}
                  <div>
                    <h2 className="text-xl font-bold">{selectedIssue.title}</h2>
                    <div className="text-sm text-gray-600 mt-1">
                      {selectedIssue.domain} · {selectedIssue.issue_type}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedIssue(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {selectedIssue.description && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-medium mb-3 flex items-center gap-2 text-blue-900">
                    <FileText className="h-4 w-4" />
                    Détails du problème
                  </h3>
                  <div className="text-sm text-gray-800 whitespace-pre-line font-mono bg-white p-3 rounded border border-blue-100">
                    {selectedIssue.description}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Pages affectées ({selectedIssue.affected_pages_count})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-50 rounded-lg p-3">
                  {selectedIssue.affected_urls.map((url, idx) => {
                    const fullUrl = url.startsWith('http') ? url : `https://${selectedIssue.domain}${url}`
                    return (
                      <div
                        key={idx}
                        className="text-sm p-2 bg-white rounded border border-gray-200 hover:border-blue-300 transition-colors"
                      >
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-blue-600 flex items-center gap-2 break-all"
                        >
                          <span className="flex-1">{url}</span>
                          <ExternalLink className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        </a>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-600 mb-1 flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Détecté le
                  </div>
                  <div className="font-medium">
                    {new Date(selectedIssue.detected_at).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>

                {selectedIssue.first_seen && selectedIssue.first_seen !== selectedIssue.detected_at && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-gray-600 mb-1 flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Première détection
                    </div>
                    <div className="font-medium">
                      {new Date(selectedIssue.first_seen).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                )}

                {selectedIssue.last_seen && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-gray-600 mb-1 flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Dernière détection
                    </div>
                    <div className="font-medium">
                      {new Date(selectedIssue.last_seen).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                )}

                {selectedIssue.resolved_at && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-green-700 mb-1">Résolu le</div>
                    <div className="font-medium text-green-800">
                      {new Date(selectedIssue.resolved_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-600 mb-1">Source</div>
                  <div className="font-medium capitalize">{selectedIssue.source}</div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-600 mb-1">Statut</div>
                  <div>{getStatusBadge(selectedIssue.status)}</div>
                </div>

                {selectedIssue.gsc_notification_id && (
                  <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                    <div className="text-gray-600 mb-1">ID Notification GSC</div>
                    <div className="font-mono text-xs break-all">{selectedIssue.gsc_notification_id}</div>
                  </div>
                )}
              </div>

              {/* Recommandations d'action */}
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-300">
                <h3 className="font-medium mb-3 flex items-center gap-2 text-yellow-900">
                  <Lightbulb className="h-5 w-5" />
                  Actions recommandées
                </h3>
                <ul className="text-sm text-gray-800 space-y-2 ml-4 list-disc">
                  {selectedIssue.severity === 'error' && (
                    <>
                      <li><strong>Vérifier l'accessibilité</strong> : S'assurer que l'URL est accessible et ne retourne pas d'erreur 404 ou 5xx</li>
                      <li><strong>Robots.txt</strong> : Vérifier que l'URL n'est pas bloquée dans le fichier robots.txt</li>
                      <li><strong>Demander un crawl</strong> : Utiliser l'outil <a href={`https://search.google.com/search-console/inspect?resource=sc-domain:${selectedIssue.domain}&url=${encodeURIComponent(selectedIssue.affected_urls[0] || '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">URL Inspection de GSC</a> pour demander un nouveau crawl</li>
                      <li><strong>Vérifier les redirections</strong> : S'assurer qu'il n'y a pas de redirection 301/302 qui empêche l'indexation</li>
                    </>
                  )}
                  {selectedIssue.severity === 'warning' && selectedIssue.issue_type === 'indexing' && (
                    <>
                      <li><strong>Balises meta</strong> : Vérifier les balises meta robots sur la page (noindex, nofollow)</li>
                      <li><strong>Canonical</strong> : Vérifier que la balise canonical pointe vers la bonne URL</li>
                      <li><strong>Robots.txt</strong> : Vérifier les règles qui pourraient exclure la page</li>
                      <li><strong>Qualité du contenu</strong> : Vérifier que le contenu est unique et de qualité</li>
                    </>
                  )}
                  {(selectedIssue.issue_type === 'coverage' || selectedIssue.description?.includes('EXCLUDED')) && (
                    <>
                      <li><strong>Robots.txt</strong> : Vérifier les règles d'exclusion (Disallow) qui pourraient bloquer la page</li>
                      <li><strong>Meta noindex</strong> : Vérifier si la page contient une balise meta noindex</li>
                      <li><strong>Sitemap</strong> : Vérifier que l'URL est bien présente dans le sitemap.xml</li>
                      <li><strong>Raison d'exclusion</strong> : Consulter la description pour identifier la cause précise</li>
                    </>
                  )}
                  {!selectedIssue.description?.includes('FAIL') && !selectedIssue.description?.includes('EXCLUDED') && (
                    <>
                      <li><strong>Analyser la description</strong> : Consulter les détails techniques ci-dessus pour identifier le problème spécifique</li>
                      <li><strong>Outil GSC</strong> : Utiliser l'<a href={`https://search.google.com/search-console/inspect?resource=sc-domain:${selectedIssue.domain}&url=${encodeURIComponent(selectedIssue.affected_urls[0] || '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">URL Inspection</a> pour plus de détails</li>
                      <li><strong>Suivi</strong> : Marquer l'issue comme résolue une fois le problème corrigé</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

