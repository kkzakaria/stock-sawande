-- Helper: crée un utilisateur dans auth.users + profiles
-- Usage: SELECT tests.create_test_user('admin', 'admin');
CREATE SCHEMA IF NOT EXISTS tests;

CREATE OR REPLACE FUNCTION tests.create_test_user(
  slug text,
  user_role public.user_role DEFAULT 'cashier'
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  VALUES (v_id, '00000000-0000-0000-0000-000000000000', slug || '@test.local', crypt('password', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated');
  -- handle_new_user trigger creates profiles row with default 'cashier'
  UPDATE public.profiles SET role = user_role, full_name = slug WHERE id = v_id;
  RETURN v_id;
END $$;

-- Helper: authentifie comme un utilisateur donné pour les tests RLS
CREATE OR REPLACE FUNCTION tests.authenticate_as(user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_id::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

CREATE OR REPLACE FUNCTION tests.clear_authentication()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END $$;
