-- Add preferred_language column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'fr';

-- Add comment
COMMENT ON COLUMN public.profiles.preferred_language IS 'User preferred language for the interface (fr, en)';
