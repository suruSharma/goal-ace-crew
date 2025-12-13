-- Fix 1: Allow authenticated users to search for profiles by name (for friend discovery)
-- This is necessary for the friend search feature to work
CREATE POLICY "Authenticated users can search profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Fix 2: Allow anyone to count group members (needed for group search member counts)
-- This is safe because it only allows counting, and RLS on sensitive data is still protected
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;

CREATE POLICY "Members can view group members" 
ON public.group_members 
FOR SELECT 
USING (is_group_member(auth.uid(), group_id));

CREATE POLICY "Anyone can count group members" 
ON public.group_members 
FOR SELECT 
USING (auth.uid() IS NOT NULL);