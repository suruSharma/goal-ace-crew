-- Add goal_date column to profiles
ALTER TABLE public.profiles 
ADD COLUMN goal_date date;