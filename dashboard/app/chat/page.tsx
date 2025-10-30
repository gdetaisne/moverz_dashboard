'use client'

import { useState, useEffect } from 'react'
import ChatBot from '@/components/ChatBot'
import { MessageSquare } from 'lucide-react'

export default function ChatPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
          <MessageSquare className="h-10 w-10 text-blue-600" />
          Assistant Analytique
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          Posez des questions en langage naturel sur vos données BigQuery
        </p>
      </div>

      {/* ChatBot Component */}
      <div className="h-[600px]">
        <ChatBot />
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Exemples de questions :</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• "Quels sites ont le plus d'impressions cette semaine ?"</li>
          <li>• "Quelle est la tendance des clics pour Marseille ?"</li>
          <li>• "Montre-moi les 10 pages les plus performantes"</li>
          <li>• "Compare les performances entre cette semaine et la semaine dernière"</li>
          <li>• "Quels sites ont le meilleur CTR ?"</li>
        </ul>
      </div>

      {/* Technical Info */}
      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
        <p>
          🔧 <strong>Technologie :</strong> GPT-4 pour générer des requêtes SQL + analyse BigQuery
        </p>
      </div>
    </div>
  )
}

