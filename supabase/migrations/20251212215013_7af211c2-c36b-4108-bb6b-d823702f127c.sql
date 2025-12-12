-- Fix 1: Drop overly permissive profile search policy and add friends policy
DROP POLICY IF EXISTS "Users can search for profiles by name" ON public.profiles;

-- Add policy to view friends' profiles (using existing are_friends function)
CREATE POLICY "Users can view friends profiles" 
ON public.profiles 
FOR SELECT 
USING (are_friends(auth.uid(), id));

-- Fix 2: Create a security definer function to get public groups without invite_code
CREATE OR REPLACE FUNCTION public.get_public_groups()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  status text,
  created_by uuid,
  created_at timestamptz,
  total_days integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.name, g.description, g.status, g.created_by, g.created_at, g.total_days
  FROM public.groups g
  WHERE g.status = 'published'
$$;

-- Restrict the groups SELECT policy to only show full data (including invite_code) to creators and members
DROP POLICY IF EXISTS "Users can view published groups or their own drafts" ON public.groups;

-- Creators can see their own groups (including drafts)
CREATE POLICY "Creators can view their own groups" 
ON public.groups 
FOR SELECT 
USING (created_by = auth.uid());

-- Members can view groups they belong to
CREATE POLICY "Members can view their groups" 
ON public.groups 
FOR SELECT 
USING (is_group_member(auth.uid(), id));