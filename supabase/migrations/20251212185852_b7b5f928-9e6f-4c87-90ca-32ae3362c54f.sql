-- Allow group members to view profiles of other group members
CREATE POLICY "Group members can view other members profiles"
ON public.profiles
FOR SELECT
USING (
  id IN (
    SELECT gm.user_id 
    FROM group_members gm 
    WHERE gm.group_id IN (
      SELECT gm2.group_id 
      FROM group_members gm2 
      WHERE gm2.user_id = auth.uid()
    )
  )
);