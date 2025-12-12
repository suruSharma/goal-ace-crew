-- Add status column to groups table for draft/published workflow
ALTER TABLE public.groups 
ADD COLUMN status text NOT NULL DEFAULT 'draft' 
CHECK (status IN ('draft', 'published'));

-- Update existing groups to be published (they were created before this feature)
UPDATE public.groups SET status = 'published';

-- Update RLS policy to only show published groups or drafts owned by the user
DROP POLICY IF EXISTS "Anyone can view groups" ON public.groups;

CREATE POLICY "Users can view published groups or their own drafts" 
ON public.groups 
FOR SELECT 
USING (
  status = 'published' 
  OR created_by = auth.uid()
);