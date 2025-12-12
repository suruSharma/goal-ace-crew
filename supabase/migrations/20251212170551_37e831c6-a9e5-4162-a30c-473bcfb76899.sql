-- Create group_comments table for group discussions
CREATE TABLE public.group_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_comments ENABLE ROW LEVEL SECURITY;

-- Group members can view comments in their groups
CREATE POLICY "Group members can view comments"
ON public.group_comments
FOR SELECT
USING (
  group_id IN (
    SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
  )
);

-- Group members can add comments
CREATE POLICY "Group members can add comments"
ON public.group_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  group_id IN (
    SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
  )
);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON public.group_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_group_comments_group_id ON public.group_comments(group_id);
CREATE INDEX idx_group_comments_created_at ON public.group_comments(created_at DESC);