# 📋 Changelog - Moverz Dashboard

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [1.0.0] - 2025-10-29

### 🎉 Initialisation du projet

**Créé :**
- ✅ Repository GitHub `moverz_dashboard`
- ✅ Structure de dossiers complète
- ✅ Documentation de base
- ✅ Roadmap 4 phases

**Dossiers :**
```
moverz_dashboard/
├── docs/                # Documentation technique
├── etl/                 # Scripts ETL (à venir Phase 2)
├── scripts/             # Utilitaires (à venir Phase 1)
├── agents/              # Agents IA (Phase 4)
└── web/                 # Dashboard web (optionnel Phase 3)
```

**Documentation migrée :**
- ✅ `docs/PLAN-ANALYTICS-HYBRIDE-FINAL.md` (depuis moverz_main)
- ✅ `docs/PRESENTATION-ANALYTICS-EXTERNE.md` (depuis moverz_main)

### 📊 État initial

**Roadmap définie :**
- Phase 1 : GA4 & Tracking (Semaine 1)
- Phase 2 : GSC & BigQuery (Semaines 2-3)
- Phase 3 : Dashboard Looker Studio (Semaine 4)
- Phase 4 : Agents IA (Semaines 5-8+)

**Budget estimé :**
- Outils : 50-180€/mois
- Développement : 35 jours (~17 500€ si freelance)

### 🎯 Prochaine étape

**Phase 1 - GA4 & Tracking** :
- Configuration GA4 (1 propriété + 11 streams)
- Création fichiers tracking Next.js
- Events custom (cta_click, form_start, form_submit)
- Déploiement sur 11 sites

**Date cible** : 5 Novembre 2025

---

## [Unreleased]

### À venir (Phase 1)
- [ ] Guide configuration GA4
- [ ] Scripts génération fichiers tracking
- [ ] Script déploiement automatique
- [ ] Tests événements GA4
- [ ] Documentation intégration Next.js 14

---

**Convention des versions :**
- MAJOR : Changements incompatibles API
- MINOR : Ajout fonctionnalités compatibles
- PATCH : Corrections de bugs

**Labels :**
- 🎉 Initialisation / Milestone majeure
- ✨ Nouvelle fonctionnalité
- 🐛 Correction de bug
- 📚 Documentation
- ♻️ Refactoring
- ⚡ Performance
- 🔒 Sécurité
- 🚀 Déploiement

---

**Dernière mise à jour** : 29 Octobre 2025  
**Mainteneur** : Guillaume Stehelin (guillaume@moverz.io)

