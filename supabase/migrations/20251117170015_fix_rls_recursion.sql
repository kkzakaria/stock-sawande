-- ============================================================================
-- FIX RLS RECURSION ISSUE
-- ============================================================================
-- The existing RLS policies cause infinite recursion because they query
-- the profiles table while evaluating policies on the profiles table itself.
--
-- Solution: Create a SECURITY DEFINER function that bypasses RLS checks
-- and use it in policies instead of direct subqueries.

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get current user's role without triggering RLS
create or replace function public.get_current_user_role()
returns user_role
language plpgsql
security definer  -- Run with privileges of function owner, bypassing RLS
set search_path = public
stable  -- Result doesn't change within a transaction
as $$
declare
  user_role_value user_role;
begin
  select role into user_role_value
  from public.profiles
  where id = auth.uid();

  return user_role_value;
end;
$$;

-- Function to get current user's store_id without triggering RLS
create or replace function public.get_current_user_store_id()
returns uuid
language plpgsql
security definer  -- Run with privileges of function owner, bypassing RLS
set search_path = public
stable  -- Result doesn't change within a transaction
as $$
declare
  user_store_id uuid;
begin
  select store_id into user_store_id
  from public.profiles
  where id = auth.uid();

  return user_store_id;
end;
$$;

-- ============================================================================
-- DROP EXISTING RECURSIVE POLICIES
-- ============================================================================

-- Drop all existing policies on profiles
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can insert profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
drop policy if exists "Admins can delete profiles" on public.profiles;
drop policy if exists "Managers can view store profiles" on public.profiles;

-- Drop recursive policies on stores
drop policy if exists "Admins can view all stores" on public.stores;
drop policy if exists "Admins can insert stores" on public.stores;
drop policy if exists "Admins can update stores" on public.stores;
drop policy if exists "Admins can delete stores" on public.stores;
drop policy if exists "Users can view their own store" on public.stores;

-- ============================================================================
-- CREATE NON-RECURSIVE POLICIES - PROFILES
-- ============================================================================

-- Users can view their own profile
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins can view all profiles (using helper function)
create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.get_current_user_role() = 'admin');

-- Admins can insert profiles (using helper function)
create policy "Admins can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (public.get_current_user_role() = 'admin');

-- Admins can update all profiles (using helper function)
create policy "Admins can update all profiles"
  on public.profiles for update
  to authenticated
  using (public.get_current_user_role() = 'admin');

-- Admins can delete profiles (using helper function)
create policy "Admins can delete profiles"
  on public.profiles for delete
  to authenticated
  using (public.get_current_user_role() = 'admin');

-- Managers can view profiles in their store (using helper function)
create policy "Managers can view store profiles"
  on public.profiles for select
  to authenticated
  using (
    public.get_current_user_role() = 'manager'
    and store_id = public.get_current_user_store_id()
  );

-- ============================================================================
-- CREATE NON-RECURSIVE POLICIES - STORES
-- ============================================================================

-- Admins can view all stores (using helper function)
create policy "Admins can view all stores"
  on public.stores for select
  to authenticated
  using (public.get_current_user_role() = 'admin');

-- Admins can insert stores (using helper function)
create policy "Admins can insert stores"
  on public.stores for insert
  to authenticated
  with check (public.get_current_user_role() = 'admin');

-- Admins can update stores (using helper function)
create policy "Admins can update stores"
  on public.stores for update
  to authenticated
  using (public.get_current_user_role() = 'admin');

-- Admins can delete stores (using helper function)
create policy "Admins can delete stores"
  on public.stores for delete
  to authenticated
  using (public.get_current_user_role() = 'admin');

-- Users can view their assigned store (using helper function)
create policy "Users can view their own store"
  on public.stores for select
  to authenticated
  using (id = public.get_current_user_store_id());

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

-- Allow authenticated users to execute the helper functions
grant execute on function public.get_current_user_role() to authenticated;
grant execute on function public.get_current_user_store_id() to authenticated;
