# Next-Stock: Stock Management & POS System

Modern stock management and point-of-sale system built with Next.js 16, React 19, and Supabase.

## Overview

Next-Stock is a comprehensive inventory and retail management solution designed for multi-store operations. It combines a powerful web dashboard with a touch-optimized POS interface, supporting offline operations and real-time inventory synchronization.

### Key Features (V1)

- **Stock Management**: Complete inventory tracking with movement history
- **Point of Sale**: Fast, keyboard-driven checkout with receipt printing
- **Product Catalog**: Unlimited products with categories, SKU, and barcodes
- **Multi-Store**: Support for multiple locations with centralized management
- **Real-time Sync**: Live inventory updates across all devices
- **Offline Mode**: POS works without internet connection
- **Reporting**: Sales, inventory, and performance analytics
- **Role-Based Access**: Administrator, Stock Manager, and Cashier roles

## Tech Stack

**Frontend:**
- Next.js 16 (App Router)
- React 19 (Server Components)
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui (New York style)

**Backend:**
- Supabase (PostgreSQL + Auth + Realtime + Auto-generated APIs)
- @supabase/ssr (Next.js 16 SSR support)
- Server Actions

**State Management:**
- Zustand (cart state)
- Supabase Realtime (server state sync)

**Key Libraries:**
- React Hook Form + Zod (forms)
- TanStack Table (data tables)
- Recharts (charts)
- react-to-print (receipts)

## Documentation

All documentation is in `/claudedocs/`:

1. **[ARCHITECTURE_REVISED.md](claudedocs/ARCHITECTURE_REVISED.md)** - Complete Supabase-first architecture
2. **[SUPABASE_SETUP.md](claudedocs/SUPABASE_SETUP.md)** - Detailed setup guide with @supabase/ssr
3. **[MIGRATION_NOTES.md](claudedocs/MIGRATION_NOTES.md)** - Changes from original Prisma-based plan
4. **[ARCHITECTURE_SUMMARY.md](claudedocs/ARCHITECTURE_SUMMARY.md)** - Visual diagrams and quick reference (original)
5. **[IMPLEMENTATION_GUIDE.md](claudedocs/IMPLEMENTATION_GUIDE.md)** - Step-by-step guide (original - needs update)
6. **[QUICK_START.md](claudedocs/QUICK_START.md)** - One-page setup guide (original - needs update)

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Supabase account

### Setup

```bash
# Clone repository
git clone <repository-url>
cd next-stock

# Install dependencies
npm install

# Install Supabase CLI (for type generation)
npm install -g supabase

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Generate TypeScript types from database
npx supabase gen types typescript \
  --project-id "your-project-ref" \
  --schema public \
  > types/database.types.ts

# Run development server
npm run dev
```

Visit http://localhost:3000

### First Steps

1. Create Supabase project at https://supabase.com
2. Run database schema (SQL in ARCHITECTURE_REVISED.md)
3. Enable Row Level Security (RLS) policies
4. Configure environment variables
5. Generate TypeScript types
6. Start development

See [SUPABASE_SETUP.md](claudedocs/SUPABASE_SETUP.md) for complete setup guide.

## Project Structure

```
next-stock/
├── app/                    # Next.js app router
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Protected dashboard
│   ├── (pos)/             # POS interface
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── layout/           # Layout components
│   └── [features]/       # Feature components
├── lib/                   # Utilities
│   ├── supabase/         # Supabase clients (browser, server, middleware)
│   ├── actions/          # Server actions
│   ├── validations/      # Zod schemas
│   ├── hooks/            # Custom React hooks
│   └── store/            # Zustand stores
├── types/                 # TypeScript types
│   ├── database.types.ts # Auto-generated from Supabase
│   └── index.ts          # Type shortcuts and extensions
└── claudedocs/           # Documentation
```

## Development Phases

### Phase 1: Foundation (2 weeks)
- Supabase project setup
- Database schema with RLS
- Authentication with @supabase/ssr
- Type generation workflow
- Base UI framework
- User management

### Phase 2: Core Features (3 weeks)
- Product management
- Inventory system
- Customer/Supplier management

### Phase 3: POS System (3 weeks)
- POS interface
- Payment processing
- Receipt printing
- Offline mode

### Phase 4: Analytics (2 weeks)
- Dashboard
- Reports
- Multi-store features

**Total MVP Timeline:** 10 weeks (400 hours)

## Key Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Supabase
npx supabase login       # Login to Supabase CLI
npx supabase gen types typescript \
  --project-id "ref" > types/database.types.ts  # Generate types
npx supabase start       # Start local Supabase (optional)
npx supabase db reset    # Reset local database (optional)

# shadcn/ui
npx shadcn@latest add [component]  # Add component
```

## Performance Targets

- POS operations: < 100ms
- Page load: < 1s
- Report generation: < 2s
- Support: 1000+ transactions/day, 10,000+ products

## Security

- Row Level Security (RLS) on all tables
- JWT-based authentication
- Organization-level data isolation
- Role-based permissions
- Input validation with Zod

## Contributing

1. Read documentation in `/claudedocs/`
2. Follow existing code patterns
3. Write tests for new features
4. Update documentation

## License

[Your License]

## Support

For questions and support:
- Documentation: `/claudedocs/`
- Issues: [GitHub Issues]
- Email: [Your Email]

---

Built with modern web technologies for performance, scalability, and developer experience.
