# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next-Stock is a stock management and point-of-sale system built with Next.js 16, React 19, and Supabase. It uses a Supabase-first architecture with PostgreSQL, PostgREST auto-generated APIs, and Row Level Security (RLS) for multi-tenant data isolation.

**Current Status:** Phase 3 (POS System) - 70% complete

## Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
pnpm tsc --noEmit        # Type checking (runs on pre-commit)

# Supabase type generation (run after schema changes)
npx supabase gen types typescript --project-id "your-project-ref" > types/database.types.ts

# Seed test data
npm run seed:users

# Add shadcn/ui components
npx shadcn@latest add [component]
```

## Architecture

### Tech Stack
- **Frontend:** Next.js 16 (App Router), React 19 (Server Components default), TypeScript 5, Tailwind CSS 4, shadcn/ui (New York style)
- **Backend:** Supabase (PostgreSQL + PostgREST + Auth + Realtime)
- **State:** Zustand (cart), nuqs (URL state for filters/pagination), Supabase Realtime (server sync)
- **Forms:** TanStack Form + Zod validation
- **Tables:** TanStack React Table with generic reusable component

### Project Structure

```
app/
├── (auth)/              # Auth pages & server actions
├── (dashboard)/         # Protected routes (products, sales, reports, pos, stores)
└── api/                 # API routes (POS checkout, cash sessions)

components/
├── ui/                  # shadcn/ui components (auto-generated)
├── data-table/          # Generic reusable data table
└── [feature]/           # Feature-specific components

lib/
├── supabase/            # Client initialization (browser.ts, server.ts)
├── actions/             # Server Actions with Zod validation
├── hooks/               # Custom hooks (filters, data tables)
├── store/               # Zustand store (cart)
└── url-state-parsers.ts # nuqs parsers for URL state

types/
├── database.types.ts    # AUTO-GENERATED from Supabase (never edit)
└── index.ts             # Custom types and helpers
```

### Key Patterns

**1. Supabase Clients**
```typescript
// Client Components
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// Server Components & Server Actions
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
```

**2. Server Actions** (`lib/actions/`)
- Mark with `'use server'`
- Validate inputs with Zod
- Return `ActionResult<T>` with `{ success, error?, data? }`

**3. URL State Management** (nuqs)
- Filters, pagination, sorting stored in URL params
- Type-safe parsers in `lib/url-state-parsers.ts`
- Custom hooks per page (useProductFilters, useSaleFilters)

**4. Data Tables**
- Generic component in `components/data-table/`
- Features: sorting, filtering, pagination, export (CSV/Excel)
- Integrates with nuqs for URL state

**5. Database**
- Row Level Security (RLS) on all tables - cannot be bypassed
- Multi-tenant via organization_id
- Product templates shared across stores, inventory per-store
- User roles: admin, manager, cashier

## Important Files

- `types/database.types.ts` - Auto-generated, never edit manually
- `middleware.ts` - Session refresh for Supabase auth
- `lib/supabase/` - Browser and server client factories
- `components/data-table/` - Reusable table with sorting, filtering, export

## Pre-commit Hooks

Husky runs TypeScript type checking and ESLint before commits. Ensure `pnpm tsc --noEmit` passes.

## Documentation

Detailed docs in `/claudedocs/`:
- `ARCHITECTURE.md` - Full technical specification
- `SETUP_GUIDE.md` - Detailed setup guide
- `IMPLEMENTATION_GUIDE.md` - Feature development guide

## MCP Servers

Configured in `.mcp.json`:
- `shadcn` - Component management
- `next-devtools` - Next.js debugging
- `supabase` - Database operations (localhost:9000)
