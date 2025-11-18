-- Create a function to change user role with proper notification
CREATE OR REPLACE FUNCTION change_user_role(
  user_email TEXT,
  new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_user_id UUID;
  old_role TEXT;
BEGIN
  -- Validate role
  IF new_role NOT IN ('admin', 'manager', 'cashier') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid role. Must be: admin, manager, or cashier'
    );
  END IF;

  -- Get user ID and current role
  SELECT id, role INTO affected_user_id, old_role
  FROM public.profiles
  WHERE email = user_email;

  IF affected_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  IF old_role = new_role THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User already has this role'
    );
  END IF;

  -- Update role (cast text to user_role enum)
  UPDATE public.profiles
  SET
    role = new_role::user_role,
    updated_at = NOW()
  WHERE id = affected_user_id;

  -- Return success with instructions
  RETURN jsonb_build_object(
    'success', true,
    'user_email', user_email,
    'old_role', old_role,
    'new_role', new_role,
    'message', 'Role updated successfully',
    'action_required', 'User must refresh their session (Refresh Session button or logout/login) to see changes'
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION change_user_role(TEXT, TEXT) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION change_user_role(user_email TEXT, new_role TEXT) IS
'Changes a user role with proper validation and returns instructions for session refresh.
Usage: SELECT change_user_role(''user@example.com'', ''admin'');';
