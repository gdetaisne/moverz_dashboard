'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

export default function SerpAnalysePage() {
  const [exportLoading, setExportLoading] = useState(false)

  async function exportToCSV() {
    if (exportLoading) return
    
    setExportLoading(true)
    try {
      const response = await fetch('/api/serp/export-csv')
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erreur inconnue' }))
        alert(`Erreur lors de l'export: ${error.message || 'Erreur inconnue'}`)
        return
      }
      
      // Récupérer le nom du fichier depuis les headers
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || 'serp-metadata-snapshots.csv'
        : 'serp-metadata-snapshots.csv'
      
      // Télécharger le fichier
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error('Erreur export CSV:', error)
      alert(`Erreur lors de l'export: ${error.message || 'Erreur inconnue'}`)
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SERP-Analyse</h1>
          <p className="mt-2 text-gray-600">
            Analyse approfondie des données SERP
          </p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={exportLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="h-4 w-4" />
          {exportLoading ? 'Export en cours...' : 'Télécharger CSV'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Page en construction...</p>
        <p className="mt-2 text-sm text-gray-400">
          Cette page contiendra l&apos;analyse approfondie des données SERP.
        </p>
        <p className="mt-4 text-sm text-gray-600">
          💡 Utilisez le bouton &quot;Télécharger CSV&quot; ci-dessus pour exporter toutes les données de snapshots métadonnées SERP.
        </p>
      </div>
    </div>
  )
}

