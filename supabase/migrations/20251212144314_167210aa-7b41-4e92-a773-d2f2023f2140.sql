-- Drop existing delete policy
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;

-- Create new policy that allows users to leave OR group owners to remove members
CREATE POLICY "Users can leave groups or owners can remove members" 
ON public.group_members 
FOR DELETE 
USING (
  auth.uid() = user_id 
  OR 
  group_id IN (
    SELECT id FROM public.groups WHERE created_by = auth.uid()
  )
);