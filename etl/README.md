# 🔄 ETL - Extract, Transform, Load

Scripts d'extraction et transformation des données vers BigQuery.

## 📁 Structure

```
etl/
├── gsc/                 # Google Search Console
│   ├── fetch.ts         # Récupération données GSC API
│   └── transform.ts     # Nettoyage & transformation
├── ga4/                 # Google Analytics 4
│   └── export.ts        # Configuration export BigQuery
├── leads/               # Leads internes
│   └── sync.ts          # PostgreSQL → BigQuery
├── web-vitals/          # Performance
│   └── aggregate.ts     # Agrégation quotidienne
├── scheduler.ts         # Orchestrateur cron
└── shared/              # Utilitaires partagés
    ├── bigquery-client.ts
    └── error-handler.ts
```

## 🚀 Usage

### Lancer manuellement

```bash
# Google Search Console
npm run etl:gsc

# Export GA4 (trigger)
npm run etl:ga4

# Sync leads
npm run etl:leads

# Agréger Web Vitals
npm run etl:vitals
```

### Scheduler automatique

```bash
# Lance tous les ETL quotidiens (cron)
npm run dev
```

## ⏰ Planning

| ETL | Fréquence | Heure | Durée |
|-----|-----------|-------|-------|
| GSC | Quotidien | 09:00 | ~5 min |
| GA4 | Quotidien | Auto (Google) | N/A |
| Leads | Quotidien | 10:00 | ~1 min |
| Web Vitals | Quotidien | 11:00 | ~2 min |

## 🔐 Variables d'environnement

```bash
# BigQuery
GCP_PROJECT_ID=moverz-analytics
GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account.json
BIGQUERY_DATASET=moverz

# GSC
GSC_DOMAINS=devis-demenageur-marseille.fr,...

# PostgreSQL (leads)
DATABASE_URL=postgresql://...
```

## 📊 Tables BigQuery créées

- `gsc_global` : Métriques quotidiennes par site
- `gsc_pages` : Performance par page
- `gsc_queries` : Performance par requête
- `ga4_events` : Export GA4 natif
- `leads` : Conversions
- `web_vitals` : LCP, CLS, INP

## 🐛 Troubleshooting

### Erreur API GSC
```bash
# Vérifier les credentials
cat $GOOGLE_SERVICE_ACCOUNT_KEY | jq .

# Tester l'accès
npm run test:gsc
```

### Erreur BigQuery
```bash
# Vérifier les permissions
bq ls moverz

# Tester l'insert
npm run test:bigquery
```

---

**Documentation complète** : `/docs/guides/etl-troubleshooting.md`

