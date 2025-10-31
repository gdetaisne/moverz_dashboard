'use client'

import { useState } from 'react'
import PageIntro from '@/components/PageIntro'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

export default function SettingsPage() {
  const [showExplanation, setShowExplanation] = useState(false)
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Paramètres</h1>
        <PageIntro
          finalite="Configurer les accès, sources et options."
          tableaux={["Clés et paramètres"]}
          sources={["Variables d'environnement", 'Stockage local']}
        />
      </div>
      
      {/* Section Explication */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-100 transition-colors rounded-lg text-sm"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-500" />
            <span className="text-slate-600 font-medium">À propos de la configuration</span>
          </div>
          {showExplanation ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>
        {showExplanation && (
          <div className="px-4 pb-4 text-sm text-slate-600 space-y-2">
            <p>Cette page affiche la configuration technique du dashboard et des pipelines de données.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>BigQuery</strong> : projet GCP et dataset utilisés pour stocker les métriques GSC</li>
              <li><strong>ETL GSC</strong> : synchronisation quotidienne automatique à 03:15 (rattrapage de la latence GSC)</li>
              <li><strong>11 sites</strong> : nombre de sites configurés et surveillés</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">💡 Pour modifier ces paramètres, éditez les variables d&apos;environnement du serveur. Les changements nécessitent un redémarrage.</p>
          </div>
        )}
      </div>
      
      <div className="bg-white rounded-lg border p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Configuration BigQuery</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Projet GCP
            </label>
            <input
              type="text"
              value={process.env.GCP_PROJECT_ID || 'moverz-dashboard'}
              disabled
              className="w-full px-4 py-2 border rounded-md bg-gray-50 text-gray-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dataset
            </label>
            <input
              type="text"
              value={process.env.BQ_DATASET || 'analytics_core'}
              disabled
              className="w-full px-4 py-2 border rounded-md bg-gray-50 text-gray-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sites Configurés
            </label>
            <p className="text-sm text-gray-600">11 sites actifs</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">ETL Google Search Console</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Synchronisation quotidienne</p>
              <p className="text-sm text-gray-600">Exécution tous les jours à 03:15 (Europe/Paris)</p>
            </div>
            <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              Actif
            </div>
          </div>
          
          <div>
            <p className="font-medium">Fenêtre de récupération</p>
            <p className="text-sm text-gray-600">3 derniers jours (rattrapage latence GSC)</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">À Propos</h2>
        
        <div className="space-y-2 text-sm text-gray-600">
          <p><span className="font-medium">Version:</span> 1.0.0</p>
          <p><span className="font-medium">Stack:</span> Next.js 14, BigQuery, Recharts</p>
          <p><span className="font-medium">Déploiement:</span> CapRover</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Stratégie (contenu interne)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Renseigne la page <span className="font-medium">Stratégie</span> pour fournir au chatbot le contexte business (vision, pricing, clients, roadmap).
        </p>
        <a
          href="/settings/strategie"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 transition"
        >
          Ouvrir la page Stratégie
        </a>
      </div>
    </div>
  )
}

