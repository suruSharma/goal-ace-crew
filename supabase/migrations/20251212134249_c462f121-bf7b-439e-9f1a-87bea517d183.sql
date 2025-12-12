-- Add total_days column to user_challenges
ALTER TABLE public.user_challenges 
ADD COLUMN total_days integer NOT NULL DEFAULT 75;