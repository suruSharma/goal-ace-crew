-- Drop policies that expose full profile data to friends and group members
DROP POLICY IF EXISTS "Group members can view other members profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view friends profiles" ON public.profiles;

-- Create a security definer function to get display-only profile info (safe fields)
CREATE OR REPLACE FUNCTION public.get_profiles_display_info(user_ids uuid[])
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
  WHERE p.id = ANY(user_ids)
$$;

-- Create a single profile display function
CREATE OR REPLACE FUNCTION public.get_profile_display_info(user_id uuid)
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
  WHERE p.id = user_id
$$;