/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Optimisations build (réduit temps + taille)
  swcMinify: true,
  
  // Mode standalone : réduit considérablement la taille de l'image Docker
  output: 'standalone',
  
  // Désactiver certaines fonctionnalités inutiles en prod
  poweredByHeader: false,
  
  // Compresser automatiquement
  compress: true,
  
  // Env vars accessibles côté client
  env: {
    NEXT_PUBLIC_SITE_NAME: 'Moverz Analytics',
  },
  
  // Réécritures pour éviter les conflits de proxy: route Next API exposée sous /dashboard-api/*
  async rewrites() {
    return [
      {
        source: '/dashboard-api/:path*',
        destination: '/api/:path*',
      },
    ]
  },
  
  // Headers de sécurité
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

