# Fix de détection Cloudflare Pages

## Problème rencontré

Le build échouait sur Cloudflare Pages avec l'erreur :
```
✘ [ERROR] The entry-point file at ".open-next/worker.js" was not found.
```

**Cause** : Le script `scripts/build.ts` ne détectait pas l'environnement Cloudflare Pages et exécutait un build Next.js standard au lieu d'un build OpenNext pour Cloudflare.

## Solution implémentée

Amélioration de la détection avec **6 méthodes de fallback** dans `scripts/build.ts` :

### Méthodes de détection (par ordre de priorité)

1. **Variables Cloudflare Pages principales**
   - `CF_PAGES === '1'` ou `CF_PAGES` défini

2. **Variables Cloudflare Pages secondaires**
   - `CF_PAGES_BRANCH` ou `CF_PAGES_URL` définis

3. **Variable de commit Cloudflare Pages**
   - `CF_PAGES_COMMIT_SHA` défini (set pendant le build)

4. **Override manuel** ✅ **Recommandé si échec**
   - `FORCE_CLOUDFLARE=1` ou `FORCE_CLOUDFLARE=true`

5. **Heuristique : CI + wrangler config** ✅ **Devrait fonctionner maintenant**
   - `CI=true` ET présence de `wrangler.toml/jsonc/json`

6. **Variables CI Cloudflare spécifiques**
   - `CI=true` ET (`CF_PAGES_COMMIT_SHA` OU `CF_PAGES_PROJECT_NAME`)

### Logging amélioré

Le script affiche maintenant toutes les variables détectées :

```
📋 Environment detection:
  CF_PAGES: not set
  CF_PAGES_BRANCH: not set
  CF_PAGES_URL: not set
  CF_PAGES_COMMIT_SHA: not set
  FORCE_CLOUDFLARE: not set
  VERCEL: not set
  CI: true
  Wrangler config: wrangler.jsonc

✅ Detection result: Cloudflare Pages
```

## Comment forcer le build Cloudflare Pages (si nécessaire)

### Option 1 : Variable d'environnement dans Cloudflare Pages Dashboard

1. Allez dans votre projet Cloudflare Pages
2. Settings → Environment variables
3. Ajoutez :
   - **Variable** : `FORCE_CLOUDFLARE`
   - **Value** : `1`
   - **Scope** : Production and Preview

### Option 2 : Variable locale pour tests

```bash
# Test local du build Cloudflare
FORCE_CLOUDFLARE=1 pnpm run build
```

## Vérification du fix

Le prochain déploiement devrait montrer :

```
🔍 Detecting deployment platform...

📋 Environment detection:
  ...
  CI: true
  Wrangler config: wrangler.jsonc

✅ Detection result: Cloudflare Pages

🟠 Cloudflare Pages detected
📦 Running OpenNext Cloudflare build...
```

Au lieu de :

```
💻 Local/Other platform detected
📦 Running standard Next.js build...
```

## Déploiement Cloudflare Pages

Le déploiement utilise `wrangler.jsonc` qui pointe vers `.open-next/worker.js` :

```jsonc
{
  "name": "next-stock",
  "main": ".open-next/worker.js",  // Entry point généré par OpenNext
  "assets": {
    "directory": ".open-next/assets"
  }
}
```

## Fichiers modifiés

- `scripts/build.ts` - Détection améliorée avec 6 méthodes de fallback
- `claudedocs/CLOUDFLARE_BUILD_FIX.md` - Cette documentation

## Next steps

1. Commit et push des changements
2. Le prochain build Cloudflare Pages devrait réussir automatiquement
3. Si échec, ajouter `FORCE_CLOUDFLARE=1` dans les variables d'environnement Cloudflare Pages
