'use client'

import { useState, useEffect } from 'react'

export default function SerpAnalysePage() {
  const [loading, setLoading] = useState(false)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">SERP-Analyse</h1>
        <p className="mt-2 text-gray-600">
          Analyse approfondie des données SERP
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Page en construction...</p>
        <p className="mt-2 text-sm text-gray-400">
          Cette page contiendra l&apos;analyse approfondie des données SERP.
        </p>
      </div>
    </div>
  )
}

