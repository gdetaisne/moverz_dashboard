'use client'

import { AlertTriangle } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-10 w-10 text-orange-600" />
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Erreurs 404</h1>
          <p className="mt-2 text-lg text-slate-600">Suivi des pages introuvables sur les 11 sites Moverz</p>
        </div>
      </div>
      
      {/* Placeholder Content */}
      <div className="bg-white rounded-lg border border-slate-200 p-12 shadow-sm text-center">
        <AlertTriangle className="h-16 w-16 text-orange-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Page en construction</h2>
        <p className="text-slate-600 mb-6">
          Le suivi des erreurs 404 sera disponible prochainement.
        </p>
        <div className="bg-slate-50 rounded-lg p-6 max-w-2xl mx-auto text-left">
          <h3 className="font-semibold text-slate-900 mb-3">🚀 Fonctionnalités prévues :</h3>
          <ul className="space-y-2 text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-orange-600 font-bold">•</span>
              <span>Liste des URLs 404 par site avec fréquence</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-600 font-bold">•</span>
              <span>Pages sources des liens cassés (referrers)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-600 font-bold">•</span>
              <span>Évolution temporelle des erreurs 404</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-600 font-bold">•</span>
              <span>Suggestions de redirections automatiques</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-600 font-bold">•</span>
              <span>Export CSV pour correction en masse</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

