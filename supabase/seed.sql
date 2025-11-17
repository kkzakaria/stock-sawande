-- Seed data for development and testing
-- This file is automatically run after migrations when using `supabase db reset`

-- ============================================================================
-- SEED STORES
-- ============================================================================

-- Insert test stores
insert into public.stores (id, name, address, phone, email)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Main Store',
    '123 Main Street, City, Country',
    '+1234567890',
    'main@example.com'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Branch Store',
    '456 Branch Avenue, City, Country',
    '+0987654321',
    'branch@example.com'
  );

-- ============================================================================
-- SEED TEST USERS
-- ============================================================================
-- Note: These users need to be created through Supabase Auth first
-- The profiles will be auto-created by the trigger
-- For local development, you can create these users manually or through the signup form

-- Example test users (create these through the signup form):
-- 1. admin@example.com (password: admin123456) - Admin user
-- 2. manager@example.com (password: manager123456) - Manager at Main Store
-- 3. cashier@example.com (password: cashier123456) - Cashier at Main Store
-- 4. cashier2@example.com (password: cashier123456) - Cashier at Branch Store

-- After creating users through signup, update their roles manually:
-- update public.profiles set role = 'admin' where email = 'admin@example.com';
-- update public.profiles set role = 'manager', store_id = '00000000-0000-0000-0000-000000000001' where email = 'manager@example.com';
-- update public.profiles set store_id = '00000000-0000-0000-0000-000000000001' where email = 'cashier@example.com';
-- update public.profiles set store_id = '00000000-0000-0000-0000-000000000002' where email = 'cashier2@example.com';

-- ============================================================================
-- HELPER FUNCTION FOR TESTING
-- ============================================================================

-- Function to promote a user to admin (useful for testing)
create or replace function public.promote_to_admin(user_email text)
returns void as $$
begin
  update public.profiles
  set role = 'admin', store_id = null
  where email = user_email;
end;
$$ language plpgsql security definer;

-- Function to assign user to store
create or replace function public.assign_to_store(user_email text, store_name text, user_role user_role default 'cashier')
returns void as $$
declare
  target_store_id uuid;
begin
  -- Get store ID
  select id into target_store_id
  from public.stores
  where name = store_name
  limit 1;

  if target_store_id is null then
    raise exception 'Store not found: %', store_name;
  end if;

  -- Update user profile
  update public.profiles
  set role = user_role, store_id = target_store_id
  where email = user_email;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- COMMENTS
-- ============================================================================
comment on function public.promote_to_admin is 'Promote a user to admin role (for testing/development)';
comment on function public.assign_to_store is 'Assign a user to a store with a specific role';
