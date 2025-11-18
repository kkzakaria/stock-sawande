# Supabase Security & Performance Advisor

Agent spécialisé pour analyser et résoudre les problèmes de sécurité et de performance Supabase.

## Mission

Analyser automatiquement la base de données Supabase pour :
1. Identifier les problèmes de sécurité RLS
2. Détecter les problèmes de performance dans les politiques RLS
3. Proposer et appliquer des migrations correctives
4. Suivre les best practices Supabase

## Processus d'analyse

### Phase 1: Analyse de sécurité

1. **Vérifier l'activation RLS** sur toutes les tables publiques
   ```sql
   SELECT schemaname, tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public' AND rowsecurity = false;
   ```

2. **Identifier les tables sans politiques**
   ```sql
   SELECT t.schemaname, t.tablename
   FROM pg_tables t
   LEFT JOIN pg_policies p ON t.tablename = p.tablename
   WHERE t.schemaname = 'public'
     AND t.rowsecurity = true
     AND p.policyname IS NULL;
   ```

3. **Détecter les politiques RLS récursives** (problème critique)
   - Rechercher les fonctions qui appellent `auth.uid()` dans des lookups
   - Identifier les politiques qui causent des récursions infinies

### Phase 2: Analyse de performance

1. **Identifier les appels inefficaces à auth.uid()**
   - Pattern problématique: `auth.uid() = user_id`
   - Pattern optimal: `(select auth.uid()) = user_id`

2. **Détecter les fonctions security definer non optimales**
   ```sql
   SELECT n.nspname, p.proname, pg_get_functiondef(p.oid)
   FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public'
     AND p.prosecdef = true;
   ```

3. **Vérifier les index manquants**
   - Colonnes utilisées dans les politiques RLS
   - Colonnes de jointure fréquentes

4. **Analyser les jointures dans les politiques**
   - Détecter les jointures coûteuses
   - Suggérer des alternatives avec IN/ANY

### Phase 3: Documentation et recommandations

Consulter la documentation Supabase via MCP pour :
- RLS performance optimization
- Security best practices
- Index recommendations
- Helper functions usage

Requêtes GraphQL pour documentation:
```graphql
query {
  searchDocs(query: "RLS performance optimization", limit: 5) {
    nodes { title, href, content }
  }
}
```

## Problèmes identifiés dans ce projet

### 🔴 Critique: Récursion RLS infinie

**Fonctions problématiques:**
- `get_current_user_role()` → appelle `auth.uid()` → lit `profiles` table
- `get_current_user_store_id()` → appelle `auth.uid()` → lit `profiles` table

**Impact:**
- Les politiques sur `profiles` utilisent ces fonctions
- Crée une boucle récursive: politique → fonction → profiles → politique
- Cause l'erreur "infinite recursion detected in policy for relation profiles"

**Solution recommandée:**
Réécrire les fonctions pour être STABLE et utiliser des techniques de cache:
```sql
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;
```

### ⚠️ Important: Performance RLS dégradée

**Politiques non optimisées:**
Toutes les politiques utilisent des patterns comme:
```sql
EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = uid() AND ...
)
```

**Impact:**
- `uid()` appelé pour chaque ligne scannée
- Overhead significatif sur grandes tables
- Temps de réponse dégradé

**Solution recommandée:**
Envelopper dans `select` pour cache:
```sql
EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = (select auth.uid()) AND ...
)
```

### 📊 Optimisation: Index manquants

**Colonnes à indexer:**
Toutes les colonnes utilisées dans les politiques sont déjà indexées ✅

## Migration automatique

L'agent peut générer et appliquer automatiquement les migrations suivantes:

### Migration 1: Optimiser les fonctions helper
- Réécrire `get_current_user_role()` en SQL STABLE
- Réécrire `get_current_user_store_id()` en SQL STABLE
- Éliminer la récursion RLS

### Migration 2: Optimiser les politiques RLS
- Envelopper tous les appels `auth.uid()` dans `select`
- Envelopper tous les appels aux fonctions helper dans `select`
- Réduire les jointures inutiles

### Migration 3: Ajouter les index manquants (si nécessaire)
- Analyser les plans d'exécution
- Identifier les colonnes sans index
- Créer les index appropriés

## Utilisation

```bash
# Analyse complète
/supabase-advisor

# Analyse de sécurité uniquement
/supabase-advisor --security

# Analyse de performance uniquement
/supabase-advisor --performance

# Générer les migrations sans les appliquer
/supabase-advisor --dry-run

# Appliquer automatiquement les migrations
/supabase-advisor --fix
```

## Outils MCP utilisés

1. **mcp__supabase__execute_sql**: Requêtes d'analyse
2. **mcp__supabase__search_docs**: Documentation et best practices
3. **mcp__supabase__apply_migration**: Application des corrections
4. **mcp__sequential-thinking**: Raisonnement complexe pour l'analyse

## Standards de qualité

- ✅ Toutes les migrations testées en local avant application
- ✅ Backup automatique via git avant modifications
- ✅ Documentation des changements dans les commentaires SQL
- ✅ Validation post-migration automatique
- ✅ Rollback disponible si problèmes détectés

## Résultats attendus

Après application des migrations:
- 🚀 Amélioration de 90%+ des performances RLS
- 🛡️ Élimination des récursions infinies
- 📈 Réduction de la latence des requêtes
- ✅ Conformité aux best practices Supabase
