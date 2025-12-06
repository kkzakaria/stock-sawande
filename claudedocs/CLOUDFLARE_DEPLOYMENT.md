# Guide de Déploiement Cloudflare

Ce guide explique comment déployer Next-Stock sur Cloudflare Workers en utilisant `@opennextjs/cloudflare`.

## Table des matières

- [Prérequis](#prérequis)
- [Configuration](#configuration)
- [Déploiement](#déploiement)
- [Variables d'environnement](#variables-denvironnement)
- [Optimisations avancées](#optimisations-avancées)
- [Dépannage](#dépannage)

## Prérequis

1. **Compte Cloudflare** : Créez un compte sur [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI** : Déjà installé dans le projet
3. **Authentification** : Connectez-vous à Cloudflare

```bash
npx wrangler login
```

## Configuration

### 1. Fichiers de configuration créés

Les fichiers suivants ont été configurés pour Cloudflare :

- **`wrangler.jsonc`** : Configuration principale de Cloudflare Workers
- **`open-next.config.ts`** : Configuration OpenNext pour Cloudflare
- **`public/_headers`** : Headers de cache pour les assets statiques
- **`next.config.ts`** : Mis à jour avec l'initialisation Cloudflare

### 2. Variables d'environnement

#### Variables Supabase requises

Vous devez configurer vos variables d'environnement Supabase dans le dashboard Cloudflare ou via la commande :

```bash
# Via le dashboard Cloudflare
# Workers & Pages > Votre projet > Settings > Environment Variables

# Ou via wrangler
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

**Variables nécessaires :**
- `NEXT_PUBLIC_SUPABASE_URL` : URL de votre instance Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` : Clé publique anonyme Supabase
- `SUPABASE_SERVICE_ROLE_KEY` : Clé de service Supabase (pour les opérations backend)

#### Ajouter des variables dans wrangler.jsonc

Éditez `wrangler.jsonc` et ajoutez vos variables publiques :

```jsonc
"vars": {
  "NEXT_PUBLIC_SUPABASE_URL": "https://votre-projet.supabase.co",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY": "votre-anon-key"
}
```

⚠️ **Important** : Ne mettez JAMAIS de secrets sensibles dans `wrangler.jsonc`. Utilisez `wrangler secret` ou le dashboard Cloudflare.

## Déploiement

### Option 1 : Déploiement direct (recommandé)

```bash
# Build et déploie en une commande
pnpm run cf:deploy
```

Cette commande :
1. Build votre application Next.js
2. Convertit la build pour Cloudflare Workers
3. Déploie sur Cloudflare

### Option 2 : Build puis déploiement séparé

```bash
# 1. Build l'application
pnpm run cf:build

# 2. Prévisualiser localement
pnpm run cf:preview

# 3. Déployer
npx opennextjs-cloudflare deploy
```

### Option 3 : Via le Dashboard Cloudflare Pages (Auto-detect)

⚡ **Nouveau** : Le projet détecte automatiquement Cloudflare Pages !

1. Créez un nouveau projet Pages dans le dashboard Cloudflare
2. Connectez votre repository Git
3. Configurez le build :
   - **Build command** : `pnpm run build` (détection automatique ✅)
   - **Build output directory** : `.open-next`
   - **Root directory** : `/`
4. Ajoutez les variables d'environnement
5. Déployez

**Comment ça marche ?** Le script `build` détecte automatiquement l'environnement :
- Variable `CF_PAGES=1` détectée → Build OpenNext Cloudflare
- Variable `VERCEL=1` détectée → Build Next.js standard
- Sinon → Build Next.js standard

## Optimisations avancées

### 1. Cache avec R2 (Stockage d'objets)

Pour améliorer les performances avec le cache incrémental :

#### a. Créer un bucket R2

```bash
npx wrangler r2 bucket create next-stock-cache
```

#### b. Mettre à jour `wrangler.jsonc`

Décommentez et configurez :

```jsonc
"r2_buckets": [
  {
    "binding": "NEXT_INC_CACHE_R2_BUCKET",
    "bucket_name": "next-stock-cache"
  }
]
```

#### c. Mettre à jour `open-next.config.ts`

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
```

### 2. Cache avec KV (Clé-valeur)

Pour le cache de tags et la révalidation :

#### a. Créer un namespace KV

```bash
npx wrangler kv:namespace create "NEXT_INC_CACHE_KV"
npx wrangler kv:namespace create "NEXT_TAG_CACHE_KV"
```

#### b. Mettre à jour `wrangler.jsonc`

```jsonc
"kv_namespaces": [
  {
    "binding": "NEXT_INC_CACHE_KV",
    "id": "votre-kv-id-cache"
  },
  {
    "binding": "NEXT_TAG_CACHE_KV",
    "id": "votre-kv-id-tags"
  }
]
```

#### c. Mettre à jour `open-next.config.ts`

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache";

export default defineCloudflareConfig({
  tagCache: kvTagCache,
});
```

### 3. Protection contre le Skew (Version Mismatch)

Pour éviter les problèmes lors des déploiements multiples :

#### a. Mettre à jour `open-next.config.ts`

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  cloudflare: {
    skewProtection: {
      enabled: true,
      maxNumberOfVersions: 20,
      maxVersionAgeDays: 7
    }
  }
});
```

#### b. Ajouter des variables dans `wrangler.jsonc`

```jsonc
"vars": {
  "CF_WORKER_NAME": "next-stock",
  "CF_PREVIEW_DOMAIN": "next-stock.workers.dev",
  "CF_WORKERS_SCRIPTS_API_TOKEN": "votre-api-token",
  "CF_ACCOUNT_ID": "votre-account-id"
}
```

## Domaine personnalisé

### Via le Dashboard Cloudflare

1. Allez dans **Workers & Pages**
2. Sélectionnez votre projet **next-stock**
3. **Custom Domains** > **Add Custom Domain**
4. Suivez les instructions pour configurer votre DNS

### Via Wrangler

```bash
npx wrangler domains add votre-domaine.com
```

## Dépannage

### ❌ Erreur : "The entry-point file at '.open-next/worker.js' was not found"

**Symptôme** : Le déploiement via Cloudflare Pages échoue avec :
```
✘ [ERROR] The entry-point file at ".open-next/worker.js" was not found.
```

**Cause** : Le build standard Next.js a été exécuté au lieu du build OpenNext Cloudflare.

**✅ Solution** : Depuis la v2.0, le projet détecte automatiquement Cloudflare Pages !

**Aucune action requise** - Le script `pnpm run build` détecte maintenant automatiquement :
- `CF_PAGES=1` (Cloudflare) → Exécute `opennextjs-cloudflare build`
- `VERCEL=1` (Vercel) → Exécute `next build`
- Autre → Exécute `next build`

**Si vous avez déjà configuré le dashboard** :
1. Allez dans **Workers & Pages** > Votre projet > **Settings** > **Build & deployments**
2. Vérifiez que **Build command** est : `pnpm run build` (pas `pnpm run cf:build`)
3. Re-déployez : le build fonctionnera automatiquement ✅

**Détails techniques** :
Le fichier `scripts/build.ts` détecte l'environnement et choisit le bon build :
```typescript
// Détection robuste avec plusieurs fallbacks
const isCloudflarePages = !!(
  process.env.CF_PAGES === '1' ||
  process.env.CF_PAGES ||
  process.env.CF_PAGES_BRANCH ||
  process.env.CF_PAGES_URL
);
const isVercel = process.env.VERCEL === '1';

if (isCloudflarePages) {
  // Run OpenNext Cloudflare build
  execSync('opennextjs-cloudflare build');
} else {
  // Run standard Next.js build
  execSync('next build');
}
```

La détection utilise plusieurs variables d'environnement Cloudflare Pages :
- `CF_PAGES=1` (variable officielle)
- `CF_PAGES_BRANCH` (branche de déploiement)
- `CF_PAGES_URL` (URL de déploiement)

Si aucune n'est détectée, le build standard Next.js est utilisé.

### Erreur : "Missing entry-point to Worker script" (build manuel)

**Si vous utilisez la CLI locale** :

```bash
pnpm run cf:build
npx opennextjs-cloudflare deploy
```

### Erreur : Build timeout ou out of memory

**Solution** : Utilisez le flag `--no-build-cache` :

```bash
pnpm build --no-build-cache
pnpm run cf:build
```

### Variables d'environnement non disponibles

**Solution** : Vérifiez que les variables sont bien définies :

```bash
# Vérifier les secrets configurés
npx wrangler secret list

# Ajouter un secret manquant
npx wrangler secret put VARIABLE_NAME
```

### Service Worker (PWA) ne fonctionne pas

**Solution** : Les Service Workers ne sont pas compatibles avec Cloudflare Workers par défaut. Vous devrez :
1. Désactiver PWA pour Cloudflare : `DISABLE_PWA=true pnpm run cf:build`
2. Ou utiliser Cloudflare Pages avec un service worker statique

### Images non optimisées

**Solution** : Cloudflare Images est automatiquement utilisé avec le binding `IMAGES`. Vérifiez que :
- Le binding est présent dans `wrangler.jsonc`
- Vous utilisez le composant `next/image`

### Erreur 524 (Timeout)

**Solution** : Les Workers ont une limite d'exécution. Pour les opérations longues :
1. Utilisez des Durable Objects
2. Déplacez la logique vers des API externes
3. Optimisez les requêtes Supabase

## Monitoring et logs

### Visualiser les logs en temps réel

```bash
npx wrangler tail
```

### Logs dans le Dashboard

1. **Workers & Pages** > Votre projet
2. **Logs** (via Logpush ou Workers Analytics)

### Analytics

Cloudflare fournit des analytics détaillées :
- Requêtes par seconde
- Latence
- Erreurs
- Bande passante

## Rollback

En cas de problème, vous pouvez revenir à une version précédente :

```bash
# Lister les déploiements
npx wrangler deployments list

# Rollback vers une version spécifique
npx wrangler rollback <deployment-id>
```

## Ressources supplémentaires

- [Documentation OpenNext Cloudflare](https://opennext.js.org/cloudflare)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Next.js on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Supabase avec Cloudflare](https://supabase.com/docs/guides/platform/going-into-prod#cloudflare-workers)

## Support

Si vous rencontrez des problèmes :
1. Vérifiez les logs avec `npx wrangler tail`
2. Consultez la [documentation OpenNext](https://opennext.js.org/cloudflare)
3. Ouvrez une issue sur [GitHub OpenNext](https://github.com/opennextjs/opennextjs-cloudflare/issues)
