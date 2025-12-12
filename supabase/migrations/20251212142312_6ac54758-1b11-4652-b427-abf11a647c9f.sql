-- Create cheers table for group member encouragement
CREATE TABLE public.cheers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  emoji text NOT NULL DEFAULT '🔥',
  message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cheers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Group members can view cheers in their groups"
ON public.cheers
FOR SELECT
USING (
  group_id IN (
    SELECT group_id FROM group_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Group members can send cheers"
ON public.cheers
FOR INSERT
WITH CHECK (
  auth.uid() = from_user_id AND
  group_id IN (
    SELECT group_id FROM group_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own cheers"
ON public.cheers
FOR DELETE
USING (auth.uid() = from_user_id);

-- Create index for efficient queries
CREATE INDEX idx_cheers_to_user ON public.cheers(to_user_id, created_at DESC);
CREATE INDEX idx_cheers_group ON public.cheers(group_id, created_at DESC);