-- Add recovery_email column to profiles for password reset
ALTER TABLE public.profiles 
ADD COLUMN recovery_email text;