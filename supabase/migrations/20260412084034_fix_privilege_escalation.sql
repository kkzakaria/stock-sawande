-- Migration: fix_privilege_escalation
-- Closes #20, #21, #22
-- Prevents privilege escalation via profiles.role, neutralises change_user_role(),
-- and tightens manager_pins RLS to require manager/admin role.

-- ============================================================
-- PART A: Prevent profiles.role self-elevation (#20)
-- ============================================================

-- Revoke all UPDATE from authenticated/anon, then re-grant only safe columns
-- (role is included but protected by the trigger below)
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, avatar_url, preferred_language, role) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_role_self_elevation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_uid  uuid;
  v_caller_role public.user_role;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    v_caller_uid := (SELECT auth.uid());

    -- No auth session (postgres superuser / service_role) — allow through
    IF v_caller_uid IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT role INTO v_caller_role
    FROM public.profiles
    WHERE id = v_caller_uid;

    IF v_caller_role IS DISTINCT FROM 'admin'::public.user_role THEN
      RAISE EXCEPTION 'Only administrators can change user roles'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS prevent_role_self_elevation_trigger ON public.profiles;
CREATE TRIGGER prevent_role_self_elevation_trigger
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_elevation();

-- ============================================================
-- PART B: Neutralize change_user_role() (#21)
-- Move to private schema and revoke public execute
-- ============================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated, public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'change_user_role'
  ) THEN
    ALTER FUNCTION public.change_user_role(text, text) SET SCHEMA private;
  END IF;
END $$;

-- Revoke execute from all non-superuser roles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'change_user_role'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION private.change_user_role(text, text) FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

-- ============================================================
-- PART C: Tighten manager_pins RLS (#22)
-- Restrict INSERT/UPDATE to users with manager or admin role
-- ============================================================

DROP POLICY IF EXISTS "Users can insert their own PIN" ON public.manager_pins;
CREATE POLICY "Managers can insert their own PIN"
  ON public.manager_pins FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
  );

DROP POLICY IF EXISTS "Users can update their own PIN" ON public.manager_pins;
CREATE POLICY "Managers can update their own PIN"
  ON public.manager_pins FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (SELECT public.get_current_user_role()) IN ('admin'::public.user_role, 'manager'::public.user_role)
  );
