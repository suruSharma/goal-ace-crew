-- Add theme preference columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS color_theme text DEFAULT 'purple',
ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'system';