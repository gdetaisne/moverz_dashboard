import { ExternalLink } from 'lucide-react'

interface Insight {
  id?: string
  run_date?: string
  site: string
  agent: string
  severity: 'info' | 'warn' | 'critical'
  title: string
  summary: string
  score?: number
  created_at: string
  payload?: any
  evidence?: any
  suggested_actions?: any[]
}

interface InsightCardProps {
  insight: Insight
  showSite?: boolean
}

export function InsightCard({ insight, showSite = true }: InsightCardProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-300'
      case 'warn': return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'info': return 'bg-blue-100 text-blue-700 border-blue-300'
      default: return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  const getAgentIcon = (agent: string) => {
    switch (agent) {
      case 'report': return '📊'
      case 'traffic': return '🚦'
      case 'seo': return '🔍'
      case 'content': return '📝'
      default: return '🤖'
    }
  }

  const getAgentLabel = (agent: string) => {
    switch (agent) {
      case 'report': return 'Rapport'
      case 'traffic': return 'Trafic'
      case 'seo': return 'SEO'
      case 'content': return 'Contenu'
      default: return agent
    }
  }

  return (
    <div className="bg-white rounded-lg border p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{getAgentIcon(insight.agent)}</span>
          <div>
            <h3 className="text-xl font-bold">{insight.title}</h3>
            <p className="text-sm text-gray-500">
              {showSite && <span>{insight.site} • </span>}
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                {getAgentLabel(insight.agent)}
              </span>
              {' • '}
              {new Date(insight.created_at).toLocaleDateString('fr-FR', { 
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(insight.severity)}`}>
            {insight.severity}
          </span>
          {insight.score !== undefined && (
            <div className="bg-gray-100 px-3 py-1 rounded-full text-sm font-medium">
              Score: {(insight.score * 100).toFixed(0)}%
            </div>
          )}
        </div>
      </div>

      <p className="text-gray-700 mb-4">{insight.summary}</p>

      {/* Actions suggérées */}
      {insight.suggested_actions && insight.suggested_actions.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h4 className="font-semibold mb-2">💡 Actions recommandées :</h4>
          <div className="space-y-2">
            {insight.suggested_actions.slice(0, 3).map((action: any, idx: number) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-medium ${
                  action.priority === 'critical' ? 'bg-red-100 text-red-700' :
                  action.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {action.priority}
                </span>
                <span className="text-gray-700">{action.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rapport complet (pour les rapports hebdo) */}
      {insight.agent === 'report' && insight.payload?.report_md && (
        <details className="mt-4 border-t pt-4">
          <summary className="cursor-pointer font-semibold text-blue-600 hover:text-blue-700">
            📄 Voir le rapport complet
          </summary>
          <div className="mt-4 prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-md overflow-auto">
              {insight.payload.report_md}
            </pre>
          </div>
        </details>
      )}
    </div>
  )
}

