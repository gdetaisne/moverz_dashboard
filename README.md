# 📊 Moverz Dashboard - Analytics & IA

**Système analytics complet pour le réseau Moverz (11 sites de déménagement)**

[![Status](https://img.shields.io/badge/status-en_développement-yellow)]()
[![Version](https://img.shields.io/badge/version-1.0.0-blue)]()

---

## 🎯 Vision

**Pilotage business 99% automatisé par IA** via analyse de données SEO, comportementales et conversions.

### Objectifs
1. ✅ Mesurer évolution indexation & visibilité SEO (Google Search Console)
2. ✅ Tracker conversions réelles (clics CTA → formulaire → lead)
3. ✅ Comparer performance des 11 villes
4. ✅ Automatiser analyses & décisions (agents IA)

---

## 🏗️ Architecture

### Stack Technique
```
11 Sites Next.js (moverz_main)
    ↓ Events tracking
Google Analytics 4 (1 propriété, 11 streams)
    ↓ Export quotidien
BigQuery (Data Warehouse)
    ↓ Requêtes SQL
Looker Studio + Agents IA (GPT-4)
    ↓ Analyses & Actions
Automatisation & Optimisations
```

### Composants
- **GA4** : Tracking comportemental (page views, CTA, formulaire)
- **GSC API** : Données SEO (impressions, clics, CTR, position)
- **BigQuery** : Centralisation & analyse
- **Looker Studio** : Visualisation humaine
- **Agents IA** : Analyses automatiques & recommandations

---

## 📁 Structure du Projet

```
moverz_dashboard/
├── README.md                    # Ce fichier
├── CHANGELOG.md                 # Historique
├── .env.example                 # Variables d'environnement
│
├── docs/                        # 📚 Documentation
│   ├── PLAN-ANALYTICS-HYBRIDE-FINAL.md
│   ├── PRESENTATION-ANALYTICS-EXTERNE.md
│   └── guides/
│
├── etl/                         # 🔄 ETL Scripts
│   ├── gsc-to-bigquery/         # Google Search Console → BigQuery
│   ├── leads-sync/              # PostgreSQL → BigQuery
│   └── web-vitals/              # Agrégation Web Vitals
│
├── scripts/                     # 🛠️ Utilitaires
│   ├── setup/                   # Configuration initiale
│   ├── deploy/                  # Déploiement tracking
│   └── test/                    # Tests événements
│
├── agents/                      # 🤖 Agents IA (Phase 4)
│   ├── seo-optimizer/
│   ├── content-strategist/
│   └── cro-optimizer/
│
└── web/                         # 🌐 Dashboard web (optionnel)
    └── (React/Next.js app)
```

---

## 🚀 Roadmap

### ✅ Phase 0 : Setup (29/10/2025)
- [x] Repository créé
- [x] Structure initialisée
- [x] Documentation migrée

### 🟡 Phase 1 : GA4 & Tracking (Semaine 1)
- [ ] Configuration GA4 (1 propriété + 11 streams)
- [ ] Création fichiers tracking Next.js
- [ ] Events custom (cta_click, form_start, form_submit)
- [ ] Déploiement sur 11 sites (moverz_main)
- [ ] Tests & validation

**Durée estimée** : 1 semaine

### ⏳ Phase 2 : GSC & BigQuery (Semaines 2-3)
- [ ] Setup BigQuery (projet GCP + schéma tables)
- [ ] ETL Google Search Console → BigQuery
- [ ] Export GA4 → BigQuery (activation)
- [ ] Agrégation Web Vitals
- [ ] Sync leads PostgreSQL → BigQuery

**Durée estimée** : 2 semaines

### ⏳ Phase 3 : Dashboard Looker Studio (Semaine 4)
- [ ] Connexion BigQuery ↔ Looker Studio
- [ ] Dashboard 1 : Vue globale multi-sites
- [ ] Dashboard 2 : Vue détail par site
- [ ] Dashboard 3 : Alertes & anomalies
- [ ] Système de notifications (Slack/Email)

**Durée estimée** : 1 semaine

### ⏳ Phase 4 : Agents IA (Semaines 5-8+)
- [ ] Infrastructure agents (API OpenAI + BigQuery)
- [ ] Agent SEO Optimizer
- [ ] Agent Content Strategist
- [ ] Agent CRO Optimizer
- [ ] Agent Report Generator
- [ ] Orchestrateur principal
- [ ] Dashboard agents (/admin/ai)

**Durée estimée** : 1 mois (évolutif)

---

## ⚙️ Installation & Configuration

### Prérequis
- Node.js 24.x
- Compte Google Analytics 4
- Compte Google Cloud (BigQuery)
- Accès Google Search Console (11 domaines)
- OpenAI API Key (Phase 4)

### Setup rapide

```bash
# 1. Cloner le repo
git clone https://github.com/gdetaisne/moverz_dashboard.git
cd moverz_dashboard

# 2. Copier .env.example
cp .env.example .env

# 3. Configurer les variables
# Éditer .env avec vos clés

# 4. Installer dépendances
npm install

# 5. Lancer Phase 1
cd scripts/setup
./phase1-ga4.sh
```

---

## 📊 KPIs Suivis

### SEO (Google Search Console)
| Métrique | Description | Objectif |
|----------|-------------|----------|
| **Impressions** | Visibilité totale | +20% trimestre |
| **Clics** | Trafic organique | +30% trimestre |
| **CTR** | Efficacité SERP | >3.5% |
| **Position** | Ranking moyen | <10 (top 10) |

### Conversions (GA4)
| Métrique | Description | Objectif |
|----------|-------------|----------|
| **CTA clicks** | Activation utilisateur | +25% trimestre |
| **Form starts** | Intention lead | +20% trimestre |
| **Form submits** | Leads générés | +15% trimestre |
| **Taux conversion** | Form submits / CTA clicks | >5% |

### Performance (Web Vitals)
| Métrique | Description | Cible |
|----------|-------------|-------|
| **LCP** | Largest Contentful Paint | <2.5s |
| **CLS** | Cumulative Layout Shift | <0.1 |
| **INP** | Interaction to Next Paint | <200ms |

---

## 🔐 Sécurité & RGPD

### Conformité
- ✅ Consent Mode v2 (GA4)
- ✅ First-party fallback (sans cookies si refus)
- ✅ Données anonymisées (pas de PII)
- ✅ Durée rétention : 18-24 mois
- ✅ Droit d'accès / suppression

### Authentification
- Service Account Google Cloud (ETL)
- OAuth 2.0 (GSC API)
- API Keys chiffrées (secrets manager)

---

## 💰 Budget

### Outils (mensuel)
| Outil | Coût | Justification |
|-------|------|---------------|
| Google Analytics 4 | 0€ | Gratuit |
| Google Search Console | 0€ | Gratuit |
| BigQuery | 0-20€ | <10GB gratuit |
| Cloud Functions | 0-10€ | 2M invocations gratuites |
| Looker Studio | 0€ | Gratuit |
| OpenAI API (GPT-4) | 50-150€ | Phase 4 uniquement |
| **Total** | **50-180€/mois** | |

### Développement (one-time)
- Phase 1 : 5 jours (~2 500€ si freelance)
- Phase 2 : 10 jours (~5 000€)
- Phase 3 : 5 jours (~2 500€)
- Phase 4 : 15 jours (~7 500€)
- **Total** : 35 jours (~17 500€)

---

## 📚 Documentation

### Guides principaux
- **[Plan Analytics Hybride](docs/PLAN-ANALYTICS-HYBRIDE-FINAL.md)** : Architecture complète
- **[Présentation Externe](docs/PRESENTATION-ANALYTICS-EXTERNE.md)** : Pour consultants

### Guides à venir
- Configuration GA4 (step-by-step)
- ETL GSC → BigQuery (tutorial)
- Agents IA (spécifications)
- Troubleshooting

---

## 🤝 Contribution

### Workflow
1. Fork le repo
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

### Standards
- Code : ESLint + Prettier
- Commits : Conventional Commits
- Documentation : Markdown + diagrammes

---

## 📞 Support

**Questions techniques** : guillaume@moverz.io  
**Issues** : [GitHub Issues](https://github.com/gdetaisne/moverz_dashboard/issues)  
**Documentation** : `/docs/`

---

## 📄 License

Propriétaire - Moverz © 2025

---

## 🎉 Statut Actuel

**Phase en cours** : Phase 1 - GA4 & Tracking  
**Dernière mise à jour** : 29 Octobre 2025  
**Contributeur principal** : Guillaume Stehelin

**Prochaine milestone** : Tracking opérationnel sur 11 sites (fin Novembre 2025)

---

**Made with ❤️ by the Moverz Team**

