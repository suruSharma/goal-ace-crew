-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can search profiles" ON public.profiles;

-- Create a security definer function for safe profile search (only returns non-sensitive fields)
CREATE OR REPLACE FUNCTION public.search_profiles_safe(search_term text)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.full_name ILIKE '%' || search_term || '%'
  AND p.id != auth.uid()
  LIMIT 10
$$;