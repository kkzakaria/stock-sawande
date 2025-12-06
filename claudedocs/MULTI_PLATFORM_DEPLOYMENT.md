# Guide de Déploiement Multi-Plateforme (Vercel + Cloudflare)

Ce guide explique comment déployer **Next-Stock** simultanément sur **Vercel** ET **Cloudflare** pour maximiser les avantages des deux plateformes.

## Table des matières

- [Pourquoi déployer sur les deux plateformes ?](#pourquoi-déployer-sur-les-deux-plateformes-)
- [Architecture multi-plateforme](#architecture-multi-plateforme)
- [Configuration](#configuration)
- [Déploiement sur Vercel](#déploiement-sur-vercel)
- [Déploiement sur Cloudflare](#déploiement-sur-cloudflare)
- [Stratégies de routage](#stratégies-de-routage)
- [Gestion des variables d'environnement](#gestion-des-variables-denvironnement)
- [Comparaison des plateformes](#comparaison-des-plateformes)
- [Bonnes pratiques](#bonnes-pratiques)

## Pourquoi déployer sur les deux plateformes ?

### 🔵 Avantages de Vercel

- ✅ **Intégration Next.js native** : Développé par les créateurs de Next.js
- ✅ **Preview Deployments** : URL de prévisualisation automatique pour chaque PR
- ✅ **Zero-config** : Détection automatique et optimisation
- ✅ **Analytics intégrés** : Web Vitals et performance monitoring
- ✅ **Edge Functions** : Support complet des API routes
- ✅ **Incremental Static Regeneration (ISR)** : Support natif optimal
- ✅ **Image Optimization** : Optimisation d'images automatique et puissante

### 🟠 Avantages de Cloudflare

- ✅ **Coûts réduits** : Plan gratuit généreux, tarification plus économique
- ✅ **Edge Network global** : 300+ datacenters dans 120+ pays
- ✅ **Performance géographique** : Latence ultra-faible partout dans le monde
- ✅ **DDoS Protection** : Protection incluse contre les attaques
- ✅ **Workers KV/R2** : Stockage distribué économique
- ✅ **Bande passante illimitée** : Pas de limite sur le plan gratuit
- ✅ **Durable Objects** : État partagé global pour temps réel

### 🎯 Stratégies d'utilisation

**Option 1 : Production principale + Preview**
- **Vercel** : Preview deployments pour les PR et staging
- **Cloudflare** : Production principale (coûts réduits, performance)

**Option 2 : Géo-distribution**
- **Vercel** : Marché principal (ex: Europe/Amérique)
- **Cloudflare** : Marchés secondaires (ex: Asie/Afrique)

**Option 3 : Redondance et failover**
- **Vercel** : Production primaire
- **Cloudflare** : Backup automatique en cas de panne

**Option 4 : A/B Testing**
- **Vercel** : Version A (features expérimentales)
- **Cloudflare** : Version B (version stable)

## Architecture multi-plateforme

```
┌─────────────────────────────────────────────────────┐
│              Git Repository (GitHub)                 │
└──────────────┬─────────────────┬────────────────────┘
               │                 │
               ▼                 ▼
   ┌───────────────────┐  ┌──────────────────┐
   │  Vercel Platform  │  │ Cloudflare Pages │
   │                   │  │                  │
   │ • Auto Deploy     │  │ • Manual Deploy  │
   │ • PR Previews     │  │ • Production     │
   │ • Staging         │  │ • Global Edge    │
   └─────────┬─────────┘  └────────┬─────────┘
             │                     │
             ▼                     ▼
   ┌──────────────────────────────────────┐
   │        Supabase Database             │
   │    (Partagé entre les deux)          │
   └──────────────────────────────────────┘
```

## Configuration

### Fichiers de configuration créés

Le projet est configuré pour supporter les deux plateformes :

```
next-stock/
├── next.config.ts         # Config unifiée avec détection de plateforme
├── vercel.json            # Config spécifique Vercel (optionnel)
├── wrangler.jsonc         # Config spécifique Cloudflare
├── open-next.config.ts    # Config OpenNext pour Cloudflare
└── package.json           # Scripts séparés par plateforme
```

### Scripts disponibles

```json
{
  "scripts": {
    "build": "next build",              // Build standard (Vercel par défaut)
    "vercel:build": "next build",       // Build explicite pour Vercel
    "cf:build": "...",                  // Build pour Cloudflare
    "cf:preview": "...",                // Preview Cloudflare local
    "cf:deploy": "..."                  // Deploy vers Cloudflare
  }
}
```

### Détection automatique de la plateforme

Le `next.config.ts` détecte automatiquement la plateforme :

```typescript
// Initialize OpenNext Cloudflare only when building for Cloudflare
if (process.env.CLOUDFLARE_BUILD === 'true') {
  import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) => {
    initOpenNextCloudflareForDev();
  });
}
```

Variables d'environnement pour identification :
- **Vercel** : `NEXT_PUBLIC_DEPLOYMENT_PLATFORM=vercel`
- **Cloudflare** : `NEXT_PUBLIC_DEPLOYMENT_PLATFORM=cloudflare`

## Déploiement sur Vercel

### 1. Via le Dashboard (Recommandé)

1. **Connecter le repository**
   - Allez sur [vercel.com](https://vercel.com)
   - **Import Project** → Sélectionnez votre repository GitHub
   - Vercel détecte automatiquement Next.js

2. **Configuration automatique**
   - **Framework Preset** : Next.js (détecté automatiquement)
   - **Build Command** : `pnpm run build` (ou `pnpm run vercel:build`)
   - **Output Directory** : `.next` (automatique)
   - **Install Command** : `pnpm install` (détecté automatiquement)

3. **Variables d'environnement**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-anon-key
   SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key (secret)
   NEXT_PUBLIC_DEPLOYMENT_PLATFORM=vercel
   ```

4. **Déployer**
   - Cliquez sur **Deploy**
   - Chaque push sur `main` déclenchera un déploiement automatique
   - Chaque PR créera une preview URL

### 2. Via Vercel CLI

```bash
# Installer Vercel CLI
pnpm add -g vercel

# Login
vercel login

# Déployer
vercel

# Déployer en production
vercel --prod
```

### 3. Configuration avancée (vercel.json)

Le fichier `vercel.json` est **optionnel** mais permet :
- Personnaliser le build command
- Ajouter des headers de sécurité
- Configurer les redirects/rewrites
- Spécifier les régions

## Déploiement sur Cloudflare

Voir le guide détaillé : [`CLOUDFLARE_DEPLOYMENT.md`](./CLOUDFLARE_DEPLOYMENT.md)

### Résumé rapide

```bash
# 1. Login
npx wrangler login

# 2. Configurer wrangler.jsonc avec vos variables Supabase

# 3. Déployer
pnpm run cf:deploy
```

## Stratégies de routage

### Option 1 : DNS Routing (Simple)

Utilisez des sous-domaines différents :

```
# Vercel (Preview/Staging)
staging.next-stock.com    → Vercel

# Cloudflare (Production)
app.next-stock.com        → Cloudflare
www.next-stock.com        → Cloudflare
```

**Configuration DNS :**
- `staging.next-stock.com` → CNAME vers Vercel
- `app.next-stock.com` → CNAME vers Cloudflare Workers
- `www.next-stock.com` → CNAME vers Cloudflare Workers

### Option 2 : Geo-Routing (Avancé)

Routez selon la localisation géographique :

```
Utilisateurs Europe/Amérique → Vercel
Utilisateurs Asie/Afrique     → Cloudflare
```

**Configuration :**
1. Utilisez Cloudflare DNS avec Load Balancing
2. Configurez des règles géographiques
3. Healthchecks automatiques

### Option 3 : CDN Frontal (Expert)

Utilisez Cloudflare comme CDN devant Vercel :

```
                ┌──────────────┐
   Users  →     │  Cloudflare  │  (Cache + DDoS)
                │     CDN      │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │    Vercel    │  (Application)
                └──────────────┘
```

**Avantages :**
- Protection DDoS de Cloudflare
- Cache edge global
- Meilleure intégration Next.js de Vercel

**Configuration :**
1. Deployez sur Vercel avec domaine personnalisé
2. Configurez Cloudflare DNS pour pointer vers Vercel
3. Activez le proxy Cloudflare (orange cloud)
4. Configurez les Page Rules pour le cache

## Gestion des variables d'environnement

### Variables communes (les deux plateformes)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Secret

# App Config
NEXT_PUBLIC_APP_URL=https://votre-domaine.com
```

### Variables spécifiques Vercel

```bash
# Dashboard Vercel → Settings → Environment Variables
NEXT_PUBLIC_DEPLOYMENT_PLATFORM=vercel
VERCEL_ENV=production  # Automatique
VERCEL_URL=xxx.vercel.app  # Automatique
```

### Variables spécifiques Cloudflare

```bash
# Dans wrangler.jsonc
NEXT_PUBLIC_DEPLOYMENT_PLATFORM=cloudflare

# Via wrangler CLI (secrets)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### Synchronisation des variables

**Script de synchronisation** (optionnel) :

```bash
# sync-env.sh
#!/bin/bash

# Lire depuis .env
export SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env | cut -d '=' -f2)
export ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env | cut -d '=' -f2)

# Vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL production $SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production $ANON_KEY

# Cloudflare
# Mettez à jour manuellement wrangler.jsonc
```

## Comparaison des plateformes

### Performance

| Critère | Vercel | Cloudflare |
|---------|--------|------------|
| **Time to First Byte (TTFB)** | Excellent (Edge) | Excellent (Edge) |
| **Cold Start** | ~100-300ms | ~50-100ms |
| **Edge Locations** | 100+ | 300+ |
| **CDN** | Intégré | Intégré |
| **Image Optimization** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### Fonctionnalités Next.js

| Feature | Vercel | Cloudflare |
|---------|--------|------------|
| **SSR** | ✅ Natif | ✅ Via OpenNext |
| **SSG** | ✅ Natif | ✅ Via OpenNext |
| **ISR** | ✅ Natif | ⚠️ Avec KV/R2 |
| **Middleware** | ✅ Edge Runtime | ✅ Workers |
| **API Routes** | ✅ Serverless | ✅ Workers |
| **Image Optimization** | ✅ Automatique | ✅ Cloudflare Images |
| **Server Actions** | ✅ Natif | ✅ Compatible |

### Coûts (estimation)

**Vercel (Plan Pro - $20/mois) :**
- 100 GB bande passante
- 1000 heures serverless
- Dépassement : $40/100GB, $2/heure serverless

**Cloudflare (Plan Workers Paid - $5/mois) :**
- 10M requêtes incluses
- Bande passante illimitée
- Dépassement : $0.50/M requêtes supplémentaires

**Exemple (app avec trafic moyen) :**
- Vercel : ~$40-100/mois
- Cloudflare : ~$5-20/mois

### Limites

| Limite | Vercel | Cloudflare |
|--------|--------|------------|
| **Serverless Timeout** | 10s (Hobby), 60s (Pro) | 30s (CPU Time) |
| **Bundle Size** | 50MB | 25MB (total) |
| **Memory** | 1GB (configurable) | 128MB |
| **Concurrent Requests** | Illimité | Illimité |
| **Build Time** | 45min | 30min |

## Bonnes pratiques

### 1. Utiliser les deux pour leurs forces

```typescript
// Détection de la plateforme
const isProd = process.env.NODE_ENV === 'production';
const platform = process.env.NEXT_PUBLIC_DEPLOYMENT_PLATFORM;

// Features spécifiques par plateforme
if (platform === 'vercel') {
  // Utiliser Analytics Vercel
  // Activer Image Optimization Vercel
}

if (platform === 'cloudflare') {
  // Utiliser Cloudflare Analytics
  // Activer Workers KV pour cache
}
```

### 2. Testing cross-platform

```bash
# Test Vercel locally
pnpm run build && pnpm run start

# Test Cloudflare locally
pnpm run cf:preview
```

### 3. Monitoring unifié

Utilisez un service tiers pour centraliser :
- **Sentry** : Error tracking
- **Datadog** : APM et logs
- **Plausible/Umami** : Analytics privacy-first

### 4. CI/CD unifié

**GitHub Actions** (`.github/workflows/deploy.yml`) :

```yaml
name: Deploy Multi-Platform

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy-vercel:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm run vercel:build
      # Deploy to Vercel (automatic via GitHub integration)

  deploy-cloudflare:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm run cf:deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### 5. Feature flags par plateforme

```typescript
// lib/feature-flags.ts
export const FEATURES = {
  imageOptimization: process.env.NEXT_PUBLIC_DEPLOYMENT_PLATFORM === 'vercel',
  workersKV: process.env.NEXT_PUBLIC_DEPLOYMENT_PLATFORM === 'cloudflare',
  analytics: process.env.NEXT_PUBLIC_DEPLOYMENT_PLATFORM === 'vercel',
};
```

### 6. Cache strategy différenciée

```typescript
// Vercel : ISR natif
export const revalidate = 3600; // 1 heure

// Cloudflare : Cache avec KV
if (platform === 'cloudflare') {
  // Utiliser Workers KV pour cache persistant
}
```

## PWA et Service Workers

⚠️ **Important** : `next-pwa` peut causer des problèmes sur Cloudflare Workers car les Service Workers ne sont pas compatibles.

**Solutions :**

1. **Désactiver PWA pour Cloudflare uniquement** :
   ```bash
   DISABLE_PWA=true pnpm run cf:build
   ```

2. **Désactiver PWA globalement** (si non critique) :
   ```typescript
   // next.config.ts
   const isPWADisabled = process.env.CLOUDFLARE_BUILD === 'true';
   ```

3. **Utiliser PWA uniquement sur Vercel** :
   - Vercel : PWA activé (meilleure UX)
   - Cloudflare : PWA désactivé (compatibilité)

## Dépannage

### Erreur : Build fonctionne sur Vercel mais pas sur Cloudflare

**Causes courantes :**
- Service Workers (PWA)
- Node.js APIs non supportées par Workers
- Dépendances incompatibles

**Solution :**
1. Désactivez PWA : `DISABLE_PWA=true`
2. Vérifiez les dépendances : [Cloudflare Workers compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
3. Testez localement : `pnpm run cf:preview`

### Différences de comportement entre plateformes

**Causes :**
- Variables d'environnement différentes
- Optimisations spécifiques à la plateforme
- Timeouts différents

**Solution :**
1. Utilisez `NEXT_PUBLIC_DEPLOYMENT_PLATFORM` pour conditionner le code
2. Testez sur les deux environnements
3. Loggez pour identifier les différences

### Supabase connection issues

**Symptôme :** Fonctionne localement, erreur en production

**Solution :**
1. Vérifiez les variables d'environnement
2. Configurez Supabase pour accepter les deux origines :
   ```
   https://votre-app.vercel.app
   https://votre-app.workers.dev
   ```

## Ressources

### Documentation officielle
- [Vercel Next.js Guide](https://vercel.com/docs/frameworks/nextjs)
- [Cloudflare Pages NextJS](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [OpenNext Cloudflare](https://opennext.js.org/cloudflare)

### Guides spécifiques
- [`CLOUDFLARE_DEPLOYMENT.md`](./CLOUDFLARE_DEPLOYMENT.md) - Guide Cloudflare détaillé
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

### Communauté
- [Vercel Discord](https://vercel.com/discord)
- [Cloudflare Discord](https://discord.gg/cloudflaredev)
- [Next.js GitHub Discussions](https://github.com/vercel/next.js/discussions)

## Conclusion

Déployer sur **Vercel ET Cloudflare** vous offre :
- 🎯 Flexibilité maximale
- 💰 Optimisation des coûts
- 🌍 Performance globale
- 🛡️ Redondance et résilience

Choisissez la stratégie qui correspond le mieux à vos besoins (preview/prod, geo-routing, failover, ou A/B testing).
