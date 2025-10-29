import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

export function formatPercent(num: number): string {
  return (num * 100).toFixed(2) + '%'
}

export function formatPosition(pos: number): string {
  return pos.toFixed(1)
}

export const CITIES = [
  { id: 'marseille', name: 'Marseille', domain: 'devis-demenageur-marseille.fr' },
  { id: 'toulouse', name: 'Toulouse', domain: 'devis-demenageur-toulousain.fr' },
  { id: 'lyon', name: 'Lyon', domain: 'devis-demenageur-lyon.fr' },
  { id: 'bordeaux', name: 'Bordeaux', domain: 'bordeaux-demenageur.fr' },
  { id: 'nantes', name: 'Nantes', domain: 'devis-demenageur-nantes.fr' },
  { id: 'lille', name: 'Lille', domain: 'devis-demenageur-lille.fr' },
  { id: 'nice', name: 'Nice', domain: 'devis-demenageur-nice.fr' },
  { id: 'strasbourg', name: 'Strasbourg', domain: 'devis-demenageur-strasbourg.fr' },
  { id: 'rouen', name: 'Rouen', domain: 'devis-demenageur-rouen.fr' },
  { id: 'rennes', name: 'Rennes', domain: 'devis-demenageur-rennes.fr' },
  { id: 'montpellier', name: 'Montpellier', domain: 'devis-demenageur-montpellier.fr' },
]

export function getCityByDomain(domain: string) {
  return CITIES.find(c => c.domain === domain)
}

export function getCityById(id: string) {
  return CITIES.find(c => c.id === id)
}

