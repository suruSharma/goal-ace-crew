-- Add timezone column to profiles for accurate day calculation
ALTER TABLE public.profiles 
ADD COLUMN timezone text DEFAULT 'UTC';