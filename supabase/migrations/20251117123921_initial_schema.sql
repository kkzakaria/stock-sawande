-- Create enum for user roles
create type user_role as enum ('admin', 'manager', 'cashier');

-- ============================================================================
-- STORES TABLE
-- ============================================================================
-- Stores/locations for multi-location inventory management
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stores_name_check check (char_length(name) >= 2),
  constraint stores_email_check check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
-- User profiles linked to Supabase auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null default 'cashier',
  store_id uuid references public.stores(id) on delete set null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_email_check check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Improve query performance for common lookups
create index profiles_email_idx on public.profiles(email);
create index profiles_role_idx on public.profiles(role);
create index profiles_store_id_idx on public.profiles(store_id);
create index stores_name_idx on public.stores(name);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
alter table public.stores enable row level security;
alter table public.profiles enable row level security;

-- ============================================================================
-- RLS POLICIES - STORES
-- ============================================================================

-- Admins can do everything with stores
create policy "Admins can view all stores"
  on public.stores for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Admins can insert stores"
  on public.stores for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Admins can update stores"
  on public.stores for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

create policy "Admins can delete stores"
  on public.stores for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Managers and cashiers can view their assigned store
create policy "Users can view their own store"
  on public.stores for select
  to authenticated
  using (
    id in (
      select store_id from public.profiles
      where profiles.id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES - PROFILES
-- ============================================================================

-- Users can view their own profile
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Users can update their own profile (limited fields)
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins can view all profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Admins can insert profiles
create policy "Admins can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Admins can update any profile
create policy "Admins can update all profiles"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Admins can delete profiles
create policy "Admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Managers can view profiles in their store
create policy "Managers can view store profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles as manager
      where manager.id = auth.uid()
      and manager.role = 'manager'
      and manager.store_id = profiles.store_id
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Apply updated_at trigger to all tables
create trigger handle_stores_updated_at
  before update on public.stores
  for each row
  execute function public.handle_updated_at();

create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- Function to automatically create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'cashier');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile when user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================================
-- COMMENTS
-- ============================================================================
comment on table public.stores is 'Stores/locations for multi-location management';
comment on table public.profiles is 'User profiles with role-based access control';
comment on column public.profiles.role is 'User role: admin (all access), manager (store management), cashier (POS operations)';
comment on column public.profiles.store_id is 'Store assignment for managers and cashiers (null for admins)';
