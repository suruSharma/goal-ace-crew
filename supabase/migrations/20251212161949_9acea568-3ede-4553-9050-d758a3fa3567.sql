-- Create a security definer function to check group membership (avoids infinite recursion)
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
  )
$$;

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;

-- Create a new restrictive SELECT policy - users can only see members of groups they belong to
CREATE POLICY "Members can view group members"
ON public.group_members
FOR SELECT
USING (public.is_group_member(auth.uid(), group_id));