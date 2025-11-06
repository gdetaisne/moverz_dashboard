# 📋 Nomenclature des Tâches

**Pattern de nommage:** `[Priority]-[ID]-[Domaine]-[Description]-[Status]`

---

## 🎯 Structure du Nom

```
[Priority]-[ID]-[Domaine]-[Description]-[Status]
    ↓         ↓       ↓          ↓           ↓
   P1      001    MOBILE    migration   pas-commence
```

---

## 📊 Composants du Nom

### 1. Priority (Priorité)
**Format:** `P0`, `P1`, `P2`, `P3`

- **P0** = Critique / Bloquant production
- **P1** = Important / Impact utilisateur
- **P2** = Normal / Amélioration utile
- **P3** = Nice-to-have / Si temps disponible

**Exemples:**
- `P0-046-SERP-favicon-logo-en-pause`
- `P1-006-SEO-migration-canonicals-en-cours`

---

### 2. ID (Identifiant)
**Format:** Numéro séquentiel `000`, `001`, `002`, ... ou code spécifique

- Numérique simple : `000`, `001`, `046`
- Code spécifique : `LEADGEN-02`, `ANALYTICS-01`

**Usage:** Identifiant unique de la tâche dans le système.

**Exemples:**
- `P1-000-DOC-ZOD-migration-termine`
- `P1-001-MOBILE-migration-pas-commence`

---

### 3. Domaine (Domaine fonctionnel)
**Format:** Code majuscules court (`DOC`, `API`, `MOBILE`, `SEO`, etc.)

**Domaines courants:**
- **DOC** = Documentation
- **API** = Routes API / Backend
- **MOBILE** = Mobile / Responsive
- **SEO** = SEO / Référencement
- **PERF** = Performance
- **DEV** = Développement / Outils
- **SERP** = SERP / Résultats recherche
- **ANALYTICS** = Analytics / Tracking
- **LEADGEN** = Génération de leads

**Exemples:**
- `P1-000-DOC-ZOD-migration-termine`
- `P1-001-MOBILE-migration-pas-commence`
- `P1-006-SEO-migration-canonicals-en-cours`

---

### 4. Description
**Format:** Mots-clés en kebab-case (minuscules séparées par tirets)

**Règles:**
- Tous en minuscules
- Séparés par tirets (`-`)
- Description concise mais claire
- Utiliser mots-clés du domaine si pertinent

**Exemples:**
- `ZOD-migration`
- `migration-canonicals`
- `favicon-logo`
- `setup-tracking-Analytics`
- `metadata-articles-blog`

---

### 5. Status (Statut)
**Format:** `en-pause`, `en-attente`, `pas-commence`, `en-cours`, `fusionne`, `termine`

**Statuts possibles:**

| Statut | Signification | Équivalent système |
|--------|---------------|-------------------|
| `pas-commence` | Non démarrée | 📋 À faire |
| `en-attente` | En attente | 📋 À faire (bloquée) |
| `en-cours` | Actuellement travaillée | 🔄 En cours |
| `en-pause` | Mise en pause | ⚠️ INCOMPLET |
| `fusionne` | Mergée / Fusionnée | ✅ FINALISÉ |
| `termine` | Terminée / Finalisée | ✅ FINALISÉ |

**Exemples:**
- `P0-046-SERP-favicon-logo-en-pause`
- `P1-006-SEO-migration-canonicals-en-cours`
- `P2-043-SEO-faq-rationalisation-pas-commence`
- `P1-000-DOC-ZOD-migration-termine`

---

## 📝 Exemples Complets

### Tâches Dashboard Moverz

```
P1-000-DOC-ZOD-migration-termine
├─ Priority: P1 (Important)
├─ ID: 000
├─ Domaine: DOC (Documentation)
├─ Description: ZOD-migration
└─ Status: termine

P1-001-MOBILE-migration-pas-commence
├─ Priority: P1 (Important)
├─ ID: 001
├─ Domaine: MOBILE
├─ Description: migration
└─ Status: pas-commence

P1-002-API-ZOD-migration-restantes-pas-commence
├─ Priority: P1 (Important)
├─ ID: 002
├─ Domaine: API
├─ Description: ZOD-migration-restantes
└─ Status: pas-commence
```

### Tâches Autre Projet (Référence)

```
P0-046-SERP-favicon-logo-en-pause
P1-006-SEO-migration-canonicals-en-cours
P2-043-SEO-faq-rationalisation-pas-commence
LEADGEN-02-setup-tracking-Analytics-en-cours
ANALYTICS-01-monitoring-ctr-optimisation-termine
```

---

## 🔄 Mise à Jour du Status

### Workflow Status

```
pas-commence
    ↓ (démarrage)
en-cours
    ↓ (pause)
en-pause
    ↓ (reprise)
en-cours
    ↓ (finalisation)
termine / fusionne
```

**Mise à jour:**
- Lors du démarrage : `pas-commence` → `en-cours`
- Lors de la pause : `en-cours` → `en-pause`
- Lors de la finalisation : `en-cours` → `termine`

---

## 🎯 Règles de Nommage

### ✅ Bonnes Pratiques

1. **Cohérence des domaines:**
   - Utiliser toujours le même code pour un domaine
   - DOC, API, MOBILE, SEO, etc.

2. **Description claire:**
   - Suffisamment descriptive pour comprendre le contenu
   - Pas trop longue (5-6 mots max)

3. **Status à jour:**
   - Mettre à jour le status dans le nom quand il change
   - Renommer le dossier si nécessaire

4. **ID séquentiels:**
   - Utiliser numéros séquentiels dans chaque priorité
   - Peut avoir des codes spéciaux (LEADGEN-XX, ANALYTICS-XX)

### ❌ À Éviter

- Status obsolètes dans le nom
- Descriptions trop longues
- Domaines incohérents
- IDs dupliqués

---

## 🔧 Commandes Cursor

Pour créer une tâche avec cette nomenclature:

```
"Cursor, crée la tâche P1-MOBILE-migration-mobile-first"
```

Cursor doit:
1. Déterminer le prochain ID disponible pour P1
2. Créer: `P1-001-MOBILE-migration-mobile-first-pas-commence`
3. Créer dossier: `.cursor/tasks/P1-001-MOBILE-migration-mobile-first-pas-commence/`

Pour démarrer:
```
"Cursor, je démarre P1-001-MOBILE-migration-mobile-first"
```

Cursor doit renommer: `pas-commence` → `en-cours`

---

**Cette nomenclature est maintenant utilisée pour toutes les tâches du dashboard.**

