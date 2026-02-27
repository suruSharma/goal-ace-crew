
-- Drop the problematic restrictive "Deny anonymous access" policy
DROP POLICY IF EXISTS "Deny anonymous access" ON public.profiles;

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Recreate as a PERMISSIVE policy so only owners can SELECT their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);
