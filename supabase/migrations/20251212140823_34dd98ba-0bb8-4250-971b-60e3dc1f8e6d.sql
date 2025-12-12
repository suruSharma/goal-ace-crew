-- Add height column to profiles
ALTER TABLE public.profiles ADD COLUMN height_cm numeric NULL;

-- Create weight history table to track weight changes over time
CREATE TABLE public.weight_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight_kg numeric NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weight_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for weight_history
CREATE POLICY "Users can view their own weight history"
ON public.weight_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weight history"
ON public.weight_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weight history"
ON public.weight_history
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_weight_history_user_recorded ON public.weight_history(user_id, recorded_at DESC);