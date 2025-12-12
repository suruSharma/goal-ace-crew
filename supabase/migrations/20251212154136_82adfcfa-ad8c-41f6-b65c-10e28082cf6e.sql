-- Create quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (quotes are public/read-only for all users)
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Anyone can read quotes
CREATE POLICY "Anyone can view quotes" 
ON public.quotes 
FOR SELECT 
USING (true);

-- Only admins can manage quotes (for future use)
-- For now, we'll seed via migration